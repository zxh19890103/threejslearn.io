type CreateDialogConfig = {
  title?: string;
  width?: number;
  css?: string;
  /**@todo */
  height?: number;
  content: string;
  mounted?: ($: JQuery, $1: JQueryOne) => void;
};

type JQuery = (selector: string) => NodeListOf<HTMLDivElement>;
type JQueryOne = (selector: string) => HTMLDivElement;

const createDialog = (config: CreateDialogConfig) => {
  const dialog = document.createElement("dialog");

  dialog.style.cssText = `width: ${config.width}px;`;

  let cssname = `dialog-${Math.random().toString(16).substring(2, 8)}`;
  let css: HTMLStyleElement;

  if (config.css) {
    css = document.createElement("style");
    css.innerHTML = config.css.replace(
      /}?\s*(.+)\s*\{/g,
      `.dialog.${cssname} $1 {`
    );
    document.head.appendChild(css);
  }

  document.body.appendChild(dialog);

  dialog.onclick = (evt) => {
    if (
      (evt.target as HTMLAnchorElement).getAttribute("item-type") === "close"
    ) {
      dialog.close();
    }
  };

  dialog.innerHTML = `<div class="dialog ${cssname}" style="font-size: 0.9rem;">
<div class="dialog-header">
<h3>${config.title}</h3>
<a href="javascript:void(0);" style="outline: none" class="close" item-type="close">x</a>
</div>
<div class="dialog-content">
${config.content}
</div></div>
  `;

  dialog.showModal();

  setTimeout(() => {
    config.mounted?.(
      (selector: string) => dialog.querySelectorAll(selector),
      (selector: string) => dialog.querySelector(selector)
    );
  }, 30);
};

export { createDialog };
