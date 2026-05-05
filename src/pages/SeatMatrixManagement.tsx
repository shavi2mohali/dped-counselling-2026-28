import { useCounsellingData } from "../hooks/useCounsellingData";
import { categoryColumns } from "../utils/counselling";

export function SeatMatrixManagement() {
  const { seatMatrix } = useCounsellingData();

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-slate-950">Seat Matrix Management</h2>
        <p className="mt-1 text-sm text-slate-600">
          Official category-wise seats with real-time filled and remaining counts.
        </p>
      </div>

      <section className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[1500px] divide-y divide-slate-200">
            <thead className="table-head">
              <tr>
                <th className="sticky left-0 z-10 bg-slate-50 px-4 py-3">College</th>
                {categoryColumns.map((category) => (
                  <th key={category} className="px-3 py-3 text-center">
                    {category}
                  </th>
                ))}
                <th className="px-3 py-3 text-center">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white text-sm">
              {seatMatrix.map((college) => (
                <tr key={college.collegeName} className="hover:bg-slate-50">
                  <td className="sticky left-0 max-w-80 bg-white px-4 py-4 font-semibold text-slate-950">
                    {college.collegeName}
                  </td>
                  {categoryColumns.map((category) => (
                    <td key={category} className="px-3 py-4 text-center">
                      <div className="mx-auto w-16 rounded-md border border-slate-200 bg-slate-50 px-2 py-1">
                        <p className="text-sm font-bold text-slate-950">{college.seats[category]}</p>
                        <p className="text-xs text-emerald-700">R {college.remaining?.[category] ?? 0}</p>
                      </div>
                    </td>
                  ))}
                  <td className="px-3 py-4 text-center text-lg font-bold text-slate-950">{college.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
