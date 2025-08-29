// source.config.ts
import { defineDocs } from "fumadocs-mdx/config/zod-3";
var docs = defineDocs({
  dir: "content/docs"
  // or wherever your docs are located
});
export {
  docs
};
