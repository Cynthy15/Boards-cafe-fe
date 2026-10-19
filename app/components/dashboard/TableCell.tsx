import { Children, cloneElement, isValidElement, type ReactNode, type TdHTMLAttributes } from "react";
import { compactReference } from "@/lib/display-reference";

function compactText(node: ReactNode): ReactNode {
  return Children.map(node, (child) => {
    if (typeof child === "string") {
      const compact = compactReference(child);
      return compact === child ? child : <span title={child} className="whitespace-nowrap font-medium tabular-nums">{compact.startsWith("#") ? compact : `#${compact}`}</span>;
    }
    if (isValidElement<{ children?: ReactNode }>(child) && typeof child.type === "string" && child.props.children && !["button", "input", "select", "textarea"].includes(child.type)) {
      return cloneElement(child, {}, compactText(child.props.children));
    }
    return child;
  });
}

/** Keep full references available on hover while tables stay easy to scan. */
export function TableCell({ children, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td {...props}>{compactText(children)}</td>;
}
