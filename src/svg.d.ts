// svg.d.ts
declare module "*.svg" {
  import * as React from "react";
  const SvgComponent: React.FunctionComponent<
    React.SVGProps<SVGSVGElement> & { title?: string }
  >;
  export default SvgComponent;
}
