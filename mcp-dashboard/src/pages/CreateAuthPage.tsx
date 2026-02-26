import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import KeyValueEditor from "@/components/KeyValueEditor";
import {
  getAuthCredential,
  createAuthCredential,
  updateAuthCredential,
} from "@/lib/strapi";
import type { AuthFormData } from "@/types";

const emptyForm: AuthFormData = {
  name: "",
  display_name: "",
  auth_type: "bearer",
  bearer_token: "",
  custom_headers: {},
  description: "",
};

export default function CreateAuthPage() {
  const navigate = useNavigate();
  const { documentId } = useParams<{ documentId: string }>();
  const isEdit = !!documentId;

  const [form, setForm] = useState<AuthFormData>({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!documentId) return;
    getAuthCredential(documentId)
      .then((c) => {
        setForm({
          name: c.name,
          display_name: c.display_name,
          auth_type: c.auth_type,
          bearer_token: c.bearer_token || "",
          custom_headers: c.custom_headers || {},
          description: c.description || "",
        });
      })
      .finally(() => setLoading(false));
  }, [documentId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (isEdit) {
        await updateAuthCredential(documentId!, form);
      } else {
        await createAuthCredential(form);
      }
      navigate("/auth");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">
        {isEdit ? "Edit Credential" : "Create Credential"}
      </h2>
      <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
        {error && (
          <p className="text-sm text-destructive bg-destructive/10 p-3 rounded">{error}</p>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Name (slug)</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="my_api_key"
              required
            />
          </div>
          <div className="space-y-1">
            <Label>Display Name</Label>
            <Input
              value={form.display_name}
              onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
              placeholder="My API Key"
              required
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label>Auth Type</Label>
          <Select
            value={form.auth_type}
            onValueChange={(v) =>
              setForm((f) => ({ ...f, auth_type: v as "bearer" | "custom_headers" }))
            }
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="bearer">Bearer Token</SelectItem>
              <SelectItem value="custom_headers">Custom Headers</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {form.auth_type === "bearer" && (
          <div className="space-y-1">
            <Label>Bearer Token</Label>
            <Input
              type="password"
              value={form.bearer_token}
              onChange={(e) => setForm((f) => ({ ...f, bearer_token: e.target.value }))}
              placeholder="sk-..."
            />
          </div>
        )}

        {form.auth_type === "custom_headers" && (
          <div className="space-y-1">
            <Label>Custom Headers</Label>
            <KeyValueEditor
              value={form.custom_headers}
              onChange={(v) => setForm((f) => ({ ...f, custom_headers: v }))}
              keyPlaceholder="Header name"
              valuePlaceholder="Header value"
            />
          </div>
        )}

        <div className="space-y-1">
          <Label>Description</Label>
          <Textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="What is this credential for?"
            rows={2}
          />
        </div>

        <div className="flex gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : isEdit ? "Save" : "Create"}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate("/auth")}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
