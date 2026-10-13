#!/usr/bin/env python3
"""Upload a built docs-site to the docs server (nginx on EC2) through AWS SSM and swap it in.

The server has no inbound deploy channel, so the build is sent as base64 in chunks to a temp file,
checked against its md5, unpacked next to the live folder and swapped in. If the new site does not
answer 200 on the server, the old one is put back. Needs AWS credentials that may SendCommand to the box.

usage: deploy-docs.py <build-dir>
"""
import base64
import hashlib
import io
import json
import os
import subprocess
import sys
import tarfile
import tempfile
import time

INSTANCE = os.environ.get("DOCS_INSTANCE_ID", "i-024f73e747256edff")
HOST = os.environ.get("DOCS_HOST", "docs.whispey.pypeai.com")
CHUNK = 45000  # characters per SSM command, well under the parameter limit


def ssm(commands, label):
    spec = {"InstanceIds": [INSTANCE], "DocumentName": "AWS-RunShellScript",
            "Parameters": {"commands": commands}, "TimeoutSeconds": 120}
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
        json.dump(spec, f)
        path = f.name
    try:
        sent = subprocess.run(["aws", "ssm", "send-command", "--cli-input-json", "file://" + path,
                               "--query", "Command.CommandId", "--output", "text"], capture_output=True, text=True)
    finally:
        os.unlink(path)
    if sent.returncode:
        sys.exit(f"{label}: could not send ({sent.stderr.strip()[:300]})")
    command_id = sent.stdout.strip()
    for _ in range(80):
        time.sleep(1.5)
        got = subprocess.run(["aws", "ssm", "get-command-invocation", "--command-id", command_id, "--instance-id", INSTANCE,
                              "--query", "[Status,StandardOutputContent,StandardErrorContent]", "--output", "json"],
                             capture_output=True, text=True)
        if got.returncode:
            continue  # the invocation is not visible yet
        status, out, err = json.loads(got.stdout)
        if status in ("Success", "Failed", "Cancelled", "TimedOut"):
            if status != "Success":
                sys.exit(f"{label}: {status}\n{err[:400]}")
            return out
    sys.exit(f"{label}: no result after two minutes")


def main(build_dir):
    if not os.path.isfile(os.path.join(build_dir, "index.html")):
        sys.exit(f"{build_dir} has no index.html: build the site first")
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        tar.add(build_dir, arcname=".")
    raw = buf.getvalue()
    md5 = hashlib.md5(raw).hexdigest()
    b64 = base64.b64encode(raw).decode()
    parts = [b64[i:i + CHUNK] for i in range(0, len(b64), CHUNK)]
    print(f"build {len(raw)} bytes, md5 {md5}, {len(parts)} chunks")

    ssm(["rm -f /tmp/docs.b64"], "reset")
    for i, part in enumerate(parts, 1):
        ssm([f'printf %s "{part}" >> /tmp/docs.b64'], f"chunk {i}/{len(parts)}")
        if i % 10 == 0 or i == len(parts):
            print(f"uploaded {i}/{len(parts)}")

    check = f'curl -fs -o /dev/null -H "Host: {HOST}" localhost/'
    out = ssm([
        "set -e",
        "base64 -d /tmp/docs.b64 > /tmp/docs.tgz",
        f'echo "{md5}  /tmp/docs.tgz" | md5sum -c -',
        "rm -rf /var/www/docs-new && mkdir -p /var/www/docs-new",
        "tar xzf /tmp/docs.tgz -C /var/www/docs-new && chown -R www-data:www-data /var/www/docs-new",
        "rm -rf /var/www/docs-old && mv /var/www/docs /var/www/docs-old && mv /var/www/docs-new /var/www/docs",
        f'if {check} && curl -fs -o /dev/null -H "Host: {HOST}" localhost/workflows/overview/; then echo "swapped in"; '
        'else rm -rf /var/www/docs && mv /var/www/docs-old /var/www/docs && echo "new site failed its check, old site restored" && exit 1; fi',
    ], "swap")
    print(out.strip())


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
