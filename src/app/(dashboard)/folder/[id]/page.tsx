import { FileBrowser } from "@/components/files/file-browser";

export default async function FolderPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  return <FileBrowser folderId={id} />;
}
