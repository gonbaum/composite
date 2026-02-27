import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Settings2, Shield, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import FormField from "@/components/FormField";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const [showToken, setShowToken] = useState(false);

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
      <div className="mb-6">
        <h2 className="text-2xl font-bold">
          {isEdit ? "Edit Credential" : "Create Credential"}
        </h2>
        <p className="text-sm text-muted-foreground">
          Store authentication details for API actions.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-lg">
        {error && (
          <p className="text-sm text-destructive bg-destructive/10 p-3 rounded">{error}</p>
        )}

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings2 className="h-4 w-4 text-muted-foreground" />
              General
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Name (slug)">
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="my_api_key"
                  required
                />
              </FormField>
              <FormField label="Display Name">
                <Input
                  value={form.display_name}
                  onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
                  placeholder="My API Key"
                  required
                />
              </FormField>
            </div>

            <FormField label="Description">
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="What is this credential for?"
                rows={2}
              />
            </FormField>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4 text-muted-foreground" />
              Authentication
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField label="Auth Type">
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
            </FormField>

            {form.auth_type === "bearer" && (
              <FormField label="Bearer Token">
                <div className="relative">
                  <Input
                    type={showToken ? "text" : "password"}
                    value={form.bearer_token}
                    onChange={(e) => setForm((f) => ({ ...f, bearer_token: e.target.value }))}
                    placeholder="sk-..."
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </FormField>
            )}

            {form.auth_type === "custom_headers" && (
              <FormField label="Custom Headers">
                <KeyValueEditor
                  value={form.custom_headers}
                  onChange={(v) => setForm((f) => ({ ...f, custom_headers: v }))}
                  keyPlaceholder="Header name"
                  valuePlaceholder="Header value"
                />
              </FormField>
            )}
          </CardContent>
        </Card>

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
