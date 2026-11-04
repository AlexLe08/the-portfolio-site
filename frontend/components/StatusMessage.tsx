import type { ComponentProps, ReactNode } from "react";

type Props = {
  // error: oxide, read out at once (role="alert"). success: signal blue.
  // info: plain. Both read out politely (role="status").
  tone: "error" | "success" | "info";
  children: ReactNode;
} & Pick<ComponentProps<"div">, "ref" | "tabIndex">;

// The boxed message above a form's buttons or in place of a page's content.
// No hooks, so server and client components can both use it.
export function StatusMessage({ tone, children, ...rest }: Props) {
  const className = tone === "info" ? "form-status" : `form-status form-status--${tone}`;
  return (
    <div className={className} role={tone === "error" ? "alert" : "status"} {...rest}>
      {children}
    </div>
  );
}
