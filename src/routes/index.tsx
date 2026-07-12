import { createFileRoute } from "@tanstack/react-router";
import { BrandHeader } from "@/components/BrandHeader";
import { ClientCard } from "@/components/ClientCard";
import { NewClientDialog } from "@/components/NewClientDialog";
import { fetchClients } from "@/lib/api";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard de Ouro — Painel de Clientes" },
      {
        name: "description",
        content: "Painel do gestor: clientes, histórico e dashboards de tráfego pago.",
      },
    ],
  }),
  loader: () => fetchClients(),
  component: ClientsPanel,
});

function ClientsPanel() {
  const clients = Route.useLoaderData();
  return (
    <div className="min-h-screen">
      <BrandHeader />
      <main className="max-w-5xl mx-auto px-6 py-12 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Painel de Clientes</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Selecione um cliente para atualizar dados e abrir o dashboard.
            </p>
          </div>
          <NewClientDialog />
        </div>
        {clients.length === 0 ? (
          <p className="text-muted-foreground">Nenhum cliente cadastrado ainda.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clients.map((c) => (
              <ClientCard key={c.id} client={c} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
