import { AppLogo } from "./AppLogo";
import Spinner from "@usesend/ui/src/spinner";

export const FullScreenLoading = () => {
  return (
    <div
      role="status"
      className="flex min-h-screen flex-col items-center justify-center gap-4"
    >
      <AppLogo className="size-12" />
      <Spinner className="size-4" innerSvgClass="stroke-foreground" />
      <span className="sr-only">Loading Franceschini Email</span>
    </div>
  );
};
