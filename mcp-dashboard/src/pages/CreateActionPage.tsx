import ActionForm from "@/components/ActionForm";
import { createAction } from "@/lib/strapi";
import { sanitizeActionPayload } from "@/lib/sanitize";
import type { ActionFormData } from "@/types";

export default function CreateActionPage() {
  const handleSubmit = async (data: ActionFormData) => {
    const payload = {
      ...sanitizeActionPayload(data),
      auth_credential: data.auth_credential || null,
    };
    await createAction(payload);
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Create Action</h2>
      <ActionForm onSubmit={handleSubmit} submitLabel="Create" />
    </div>
  );
}
