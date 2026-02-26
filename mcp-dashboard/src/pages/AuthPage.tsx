import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import AuthTable from "@/components/AuthTable";
import { getAuthCredentials, deleteAuthCredential } from "@/lib/strapi";
import type { AuthCredential } from "@/types";

export default function AuthPage() {
  const navigate = useNavigate();
  const [credentials, setCredentials] = useState<AuthCredential[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setCredentials(await getAuthCredentials());
    } catch (err) {
      console.error("Failed to load credentials:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (c: AuthCredential) => {
    if (!confirm(`Delete credential "${c.display_name}"?`)) return;
    await deleteAuthCredential(c.documentId);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Auth Credentials</h2>
          <p className="text-sm text-muted-foreground">
            Manage API keys and tokens used by your actions.
          </p>
        </div>
        <Button onClick={() => navigate("/auth/new")}>
          <Plus className="mr-2 h-4 w-4" /> New Credential
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <AuthTable credentials={credentials} onDelete={handleDelete} />
      )}
    </div>
  );
}
