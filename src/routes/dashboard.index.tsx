import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { getData, subscribe } from "@/lib/store";
import { useSyncExternalStore } from "react";
import { DashboardContent } from "./dashboard";

export const Route = createFileRoute("/dashboard/")({
  component: DashboardIndexPage,
});

// Dashboard baseado no estado em memória. Usado logo após o upload da Maria Maria,
// que depende do cruzamento com a planilha do salão (não persistido no banco ainda).
function DashboardIndexPage() {
  const navigate = useNavigate();
  const store = useSyncExternalStore(subscribe, getData, getData);

  useEffect(() => {
    if (!store.dataset || !store.config) {
      navigate({ to: "/" });
    }
  }, [store.dataset, store.config, navigate]);

  if (!store.dataset || !store.config) return null;

  return <DashboardContent />;
}
