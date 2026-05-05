import { statusBadgeClass } from "../../utils/counselling";

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold capitalize ring-1 ${statusBadgeClass(status)}`}>
      {status}
    </span>
  );
}
