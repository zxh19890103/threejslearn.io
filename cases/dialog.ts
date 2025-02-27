type CreateDialogConfig = {
  title?: string;
  width?: number;
  height?: number;
  content: string;
  mounted?: ($: JQuery, $1: JQueryOne) => void;
};

type JQuery = (selector: string) => NodeListOf<HTMLDivElement>;
type JQueryOne = (selector: string) => HTMLDivElement;

const createDialog = (config: CreateDialogConfig) => {
  const init = () => {
    const dialog = document.createElement("dialog");

    dialog.style.cssText = `width: ${config.width}px;`;

    document.body.appendChild(dialog);

    dialog.onclick = (evt) => {
      if (
        (evt.target as HTMLAnchorElement).getAttribute("item-type") === "close"
      ) {
        dialog.close();
      }
    };

    dialog.innerHTML = `<div class="dialog">
<div class="dialog-header">
  <h3>${config.title}</h3>
  <a href="javascript:void(0);" class="close" item-type="close">x</a>
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

  init();
};

export { createDialog };
