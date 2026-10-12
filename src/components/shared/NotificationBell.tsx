"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type Item = { id: string; title: string; body: string | null; link: string; read_at: string | null; created_at: string };

export default function NotificationBell({ side = 'bottom', align = 'end' }: Readonly<{ side?: 'top' | 'bottom' | 'right'; align?: 'start' | 'end' }>) {
  const qc = useQueryClient();
  const { data } = useQuery<{ notifications: Item[]; unread: number }>({
    queryKey: ["qa-audit", "notifications"],
    queryFn: async () => {
      const res = await fetch("/api/qa-audit/notifications");
      if (!res.ok) throw new Error("notifications");
      return res.json();
    },
    refetchInterval: 60_000,
  });
  const markRead = useMutation({
    mutationFn: () => fetch("/api/qa-audit/notifications", { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["qa-audit", "notifications"] }),
  });
  const items = data?.notifications ?? [];
  const unread = data?.unread ?? 0;

  return (
    <DropdownMenu onOpenChange={(open) => open && unread > 0 && markRead.mutate()}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="relative h-9 w-9 rounded-lg p-0 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">{unread}</span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side={side} align={align} className="w-80 max-h-96 overflow-y-auto">
        {items.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-gray-500">No notifications yet</p>
        ) : (
          items.map((n) => (
            <DropdownMenuItem key={n.id} asChild>
              <Link href={n.link} className="flex flex-col items-start gap-0.5 px-3 py-2">
                <span className={n.read_at ? "text-sm text-gray-600 dark:text-gray-400" : "text-sm font-medium text-gray-900 dark:text-gray-100"}>{n.title}</span>
                {n.body && <span className="line-clamp-2 text-xs text-gray-500">{n.body}</span>}
                <span className="text-[11px] text-gray-400">{new Date(n.created_at).toLocaleString()}</span>
              </Link>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
