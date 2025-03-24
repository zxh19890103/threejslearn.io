__usePanel__ = (cfg: UsePanelConfig) => {
  const lineHeight = 20;

  const container = document.querySelector("#SectionPgAppWrap");

  const panelDiv = document.createElement("div");
  panelDiv.className = `panel panel-${cfg.placement}`;
  panelDiv.style.cssText = `padding: 0; width: fit-content; height: fit-content;`;

  const canvas = document.createElement("canvas");

  panelDiv.appendChild(canvas);

  canvas.style.cssText = `
  padding: 0;
  width: ${cfg.width}px;
  height: ${cfg.lines * lineHeight}px;
  `;

  const dpr = window.devicePixelRatio;
  const cW = dpr * cfg.width;
  const cH = dpr * cfg.lines * lineHeight;
  const actLh = dpr * lineHeight;

  canvas.width = cW;
  canvas.height = cH;

  const context = canvas.getContext("2d");

  context.font = `28px Nunito`;
  context.textAlign = "left";
  context.textBaseline = "middle";

  context.fillStyle = "#fff";

  container.appendChild(panelDiv);

  __usePanel_write__ = (ln: number, str: string) => {
    context.clearRect(0, actLh * ln, cW, actLh);
    context.fillText(str, 24, actLh / 2 + actLh * ln);
  };
};
