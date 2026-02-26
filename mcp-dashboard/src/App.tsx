import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import ActionsPage from "@/pages/ActionsPage";
import CreateActionPage from "@/pages/CreateActionPage";
import EditActionPage from "@/pages/EditActionPage";
import AuthPage from "@/pages/AuthPage";
import CreateAuthPage from "@/pages/CreateAuthPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<ActionsPage />} />
          <Route path="/actions/new" element={<CreateActionPage />} />
          <Route path="/actions/:documentId/edit" element={<EditActionPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/auth/new" element={<CreateAuthPage />} />
          <Route path="/auth/:documentId/edit" element={<CreateAuthPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
