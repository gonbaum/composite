import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import ActionForm from "@/components/ActionForm";
import { getAction, updateAction } from "@/lib/strapi";
import { sanitizeActionPayload } from "@/lib/sanitize";
import type { ActionFormData } from "@/types";

export default function EditActionPage() {
  const { documentId } = useParams<{ documentId: string }>();
  const [initial, setInitial] = useState<ActionFormData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!documentId) return;
    getAction(documentId)
      .then((a) => {
        setInitial(JSON.parse(JSON.stringify({
          name: a.name,
          display_name: a.display_name || "",
          description: a.description,
          action_type: a.action_type,
          tags: a.tags || [],
          parameters: a.parameters || [],
          api_config: a.api_config,
          bash_config: a.bash_config,
          composite_config: a.composite_config,
          auth_credential: a.auth_credential?.documentId || null,
          enabled: a.enabled,
        })));
      })
      .finally(() => setLoading(false));
  }, [documentId]);

  const handleSubmit = async (data: ActionFormData) => {
    if (!documentId) return;
    const payload = {
      ...sanitizeActionPayload(data),
      auth_credential: data.auth_credential || null,
    };
    await updateAction(documentId, payload);
  };

  if (loading) return <p className="text-muted-foreground">Loading...</p>;
  if (!initial) return <p className="text-destructive">Action not found</p>;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Edit Action</h2>
      <ActionForm initial={initial} onSubmit={handleSubmit} submitLabel="Save" />
    </div>
  );
}
