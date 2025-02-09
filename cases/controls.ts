const $onchange = (event: Event) => {
  const input = event.target as HTMLInputElement;

  let $key: string = input.name;
  let $value: any = null;

  switch (input.type) {
    case "color": {
      $value = hexToColor(input.value);
      break;
    }
    case "number": {
      $value = input.valueAsNumber;
      break;
    }
  }

  __onControlsDOMChanged__?.({
    [$key]: $value,
  });
  __updateTHREEJs__?.($key, $value);
};

const colorToHex = (color: number) => {
  return "#" + (color & 0xffffff).toString(16).padStart(6, "0").toUpperCase();
};
const hexToColor = (hex: string) => {
  return parseInt("0x" + hex.slice(1));
};

const $cDOM = (c: Control): HTMLDivElement => {
  const div = document.createElement("div");
  div.className = "Control";

  const label = document.createElement("label");
  label.innerText = c.label;

  div.appendChild(label);

  switch (c.type) {
    case "bit": {
      const input = document.createElement("input");
      input.name = c.name;
      input.type = "radio";
      input.onchange = $onchange;
      div.appendChild(input);
      break;
    }
    case "color": {
      const input = document.createElement("input");
      input.name = c.name;
      input.type = "color";
      input.value = colorToHex(c.value);
      input.onchange = $onchange;
      div.appendChild(input);
      break;
    }
    case "enum": {
      const input = document.createElement("select");
      input.name = c.name;
      // input.options.add();
      input.onchange = $onchange;
      div.appendChild(input);
      break;
    }
    case "number": {
      const input = document.createElement("input");
      input.name = c.name;
      input.type = "number";
      input.value = c.value;
      input.onchange = $onchange;
      div.appendChild(input);
      break;
    }
    case "string": {
      const input = document.createElement("input");
      input.name = c.name;
      input.type = "text";
      input.value = c.value;
      input.onchange = $onchange;
      div.appendChild(input);
      break;
    }
    default: {
      const span = document.createElement("span");
      span.innerText = `cant identified: ${c.type}`;
      div.appendChild(span);
      break;
    }
  }

  return div;
};

const $uDOM = (c: Control) => {
  if (!c.$el) return;

  switch (c.type) {
    case "color": {
      const input = c.$el.querySelector("input");
      input.value = colorToHex(c.value);
      break;
    }
  }
};

const controls: Record<string, Control> = {};

__defineControl__ = (name: string, type: ControlType, iniVal: any) => {
  controls[name] = {
    label: name,
    name,
    type,
    value: iniVal ?? null,
  };
};

let isUpdate = false;

__renderControls__ = (data: Record<string, any>) => {
  console.log("__renderControls__", data);
  // reassign
  for (const k in data) {
    if (!controls[k]) continue;
    controls[k].value = data[k];
  }

  // do render;
  const container = document.querySelector("#PgAppControls") as HTMLDivElement;

  if (isUpdate) {
    // update!
    for (const k in controls) {
      const ctrl = controls[k];
      $uDOM(ctrl);
    }
  } else {
    isUpdate = true;
    // create!
    for (const k in controls) {
      const ctrl = controls[k];
      ctrl.$el = $cDOM(ctrl);
      container.appendChild(ctrl.$el);
    }
  }
};

__onControlsDOMChanged__ = (data) => {
  for (const k in data) {
    const $v = data[k];
    const $t = typeof $v;
    if (
      $t === "object" ||
      $t === "undefined" ||
      $t === "symbol" ||
      $t === "function"
    ) {
      continue;
    } else {
      if ($t === "string") {
        __onControlsDOMChanged__iter__?.(`${k} = "${data[k]};"`, k, $v);
      } else {
        __onControlsDOMChanged__iter__?.(`${k} = ${data[k]};`, k, $v);
      }
    }
  }
};

export {};
