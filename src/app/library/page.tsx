import { LibraryView } from "@/components/LibraryViews";

export const metadata = { title: "Library" };

export default function Library() {
  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight text-white">Library</h1>
      <p className="mb-10 mt-1 text-sm text-white/45">Your history and saved titles, kept on this device.</p>
      <LibraryView />
    </div>
  );
}
