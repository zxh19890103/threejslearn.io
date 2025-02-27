__usePanel__ = (cfg: UsePanelConfig) => {
  const lineHeight = 20;

  const container = document.querySelector("#SectionPgAppWrap");
  const canvas = document.createElement("canvas");
  canvas.className = "panel";

  canvas.style.cssText = `
  position: absolute;
  z-index: 200;
  ${Placement2CSS[cfg.placement]}
  border: 1px solid #fff;
  background: rgba(0, 0, 0, 0.8);
  border-radius: 3px 4px;
  width: ${cfg.width}px;
  height: ${cfg.lines * lineHeight}px;
  `;

  const dpr = window.devicePixelRatio;
  const cW = dpr * cfg.width;
  const cH = dpr * cfg.lines * lineHeight;
  const actLh = dpr * lineHeight;

  canvas.width = cW;
  canvas.height = cH;

  container.appendChild(canvas);

  const context = canvas.getContext("2d");

  context.font = `28px Nunito`;
  context.textAlign = "left";
  context.textBaseline = "middle";

  context.fillStyle = "#fff";

  __usePanel_write__ = (ln: number, str: string) => {
    context.clearRect(0, actLh * ln, cW, actLh * (ln + 1));
    context.fillText(str, 24, actLh / 2 + actLh * ln);
  };
};

const Placement2CSS: Record<UsePanelConfig["placement"], string> = {
  left: `left: 0; top:  50%; transform: translate(0, -50%);`,
  "left-top": `left:0; top:  0;`,
  top: `left: 50%; top:  0; transform: translate(-50%, 0);`,
  "right-top": `right: 0; top:  0; `,
  right: `right: 0; top:  50%; transform: translate(0, -50%);`,
  "right-bottom": `right: 0; bottom:  0;`,
  bottom: `left: 50%; bottom:  0; transform: translate(-50%, 0);`,
  "left-bottom": `left: 0; bottom:  0;`,
};
