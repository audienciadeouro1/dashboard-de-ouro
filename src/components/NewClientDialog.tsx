import { useState } from "react";
import { Plus } from "lucide-react";
import { useRouter } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addClient } from "@/lib/api";
import type { DashboardProfile } from "@/lib/server/clients";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function NewClientDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [profile, setProfile] = useState<DashboardProfile>("sales");
  const [metaAccountId, setMetaAccountId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!name.trim()) {
      setError("Informe o nome do cliente.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await addClient({
        data: {
          name: name.trim(),
          slug: slugify(name),
          dashboardProfile: profile,
          metaAdAccountId: metaAccountId.trim() || null,
        },
      });
      setOpen(false);
      setName("");
      setMetaAccountId("");
      router.invalidate();
    } catch {
      setError("Erro ao salvar. O nome pode já estar em uso.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Plus className="w-4 h-4" /> Novo cliente
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo cliente</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="client-name">Nome</Label>
            <Input
              id="client-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Aki Sushi"
            />
          </div>
          <div className="space-y-2">
            <Label>Perfil do dashboard</Label>
            <Select value={profile} onValueChange={(v) => setProfile(v as DashboardProfile)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sales">Vendas / E-commerce</SelectItem>
                <SelectItem value="leads">Conversas / Leads</SelectItem>
                <SelectItem value="awareness">Alcance / Reconhecimento</SelectItem>
                <SelectItem value="engagement">Engajamento</SelectItem>
                <SelectItem value="video">Vídeo / Visualizações</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
                <SelectItem value="maria-maria">Maria Maria (Salão + WhatsApp)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="meta-account">Conta de anúncio Meta (opcional)</Label>
            <Input
              id="meta-account"
              value={metaAccountId}
              onChange={(e) => setMetaAccountId(e.target.value)}
              placeholder="Ex: 1067373311996985"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? "Salvando..." : "Salvar cliente"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
