import { createFileRoute } from "@tanstack/react-router";
import { RagApp } from "@/components/rag-app";
import "../form.css";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return <RagApp />;
}
