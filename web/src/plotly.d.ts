declare module "plotly.js-dist-min" {
  import Plotly from "plotly.js";
  export default Plotly;
}

declare module "plotly.js-basic-dist-min" {
  import Plotly from "plotly.js";
  export default Plotly;
}

declare module "react-plotly.js" {
  import * as React from "react";
  import { Config, Data, Layout } from "plotly.js";

  interface PlotParams {
    data: Data[];
    layout?: Partial<Layout>;
    config?: Partial<Config>;
    frames?: unknown[];
    style?: React.CSSProperties;
    className?: string;
    useResizeHandler?: boolean;
    onInitialized?: (figure: { data: Data[]; layout: Partial<Layout> }, graphDiv: HTMLElement) => void;
    onUpdate?: (figure: { data: Data[]; layout: Partial<Layout> }, graphDiv: HTMLElement) => void;
    onPurge?: (figure: { data: Data[]; layout: Partial<Layout> }, graphDiv: HTMLElement) => void;
    onRelayout?: (event: Readonly<Record<string, unknown>>, graphDiv: HTMLElement) => void;
  }

  const Plot: React.ComponentType<PlotParams>;
  export default Plot;
}

declare module "react-plotly.js/factory" {
  import * as React from "react";
  import { Config, Data, Layout } from "plotly.js";

  interface PlotParams {
    data: Data[];
    layout?: Partial<Layout>;
    config?: Partial<Config>;
    frames?: unknown[];
    style?: React.CSSProperties;
    className?: string;
    useResizeHandler?: boolean;
    onInitialized?: (figure: { data: Data[]; layout: Partial<Layout> }, graphDiv: HTMLElement) => void;
    onUpdate?: (figure: { data: Data[]; layout: Partial<Layout> }, graphDiv: HTMLElement) => void;
    onPurge?: (figure: { data: Data[]; layout: Partial<Layout> }, graphDiv: HTMLElement) => void;
    onRelayout?: (event: Readonly<Record<string, unknown>>, graphDiv: HTMLElement) => void;
  }

  const createPlotlyComponent: (plotly: unknown) => React.ComponentType<PlotParams>;
  export default createPlotlyComponent;
}
