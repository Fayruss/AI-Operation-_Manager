/**
 * Design System §8: "All charts: ... data-table fallback rendered
 * visually-hidden for screen readers." Renders a real <table> that's
 * visually hidden (not display:none, so screen readers still announce it)
 * but out of the sighted layout flow.
 */
export function VisuallyHiddenTable({
  caption,
  columns,
  rows
}: {
  caption: string;
  columns: string[];
  rows: (string | number)[][];
}) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          {columns.map((col) => (
            <th key={col} scope="col">
              {col}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {row.map((cell, j) => (
              <td key={j}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
