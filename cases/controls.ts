import { createDialog } from "./dialog.js";

const selectCtrlNullishValueStr = "[#nullish]";

const $onchange = (event: Event) => {
  const input = event.target as HTMLInputElement;
  const { $meta4ctrl } = input;

  let $key: string = input.name;
  let $value: any = null;

  switch ($meta4ctrl.type) {
    case "color": {
      $value = hexToColor(input.value);
      break;
    }
    case "number": {
      $value = input.valueAsNumber;
      break;
    }
    case "enum": {
      const select = input as unknown as HTMLSelectElement;

      if (select.value === selectCtrlNullishValueStr) {
        $value = null;
      } else {
        switch ($meta4ctrl.valueType) {
          case "string":
            $value = select.value;
            break;
          case "number":
          case "int":
            $value = Number(select.value);
            break;
          case "bit":
            $value = select.value === "0" ? false : true;
            break;
        }
      }
      break;
    }
    case "date": {
      $value = input.valueAsNumber;
      break;
    }
    case "bit": {
      const checkbox = input as HTMLInputElement;
      $value = checkbox.checked;
      break;
    }
    case "string": {
      $value = input.value;
      break;
    }
    case "range": {
      $value = rangeCtrlValueGet($meta4ctrl);
      break;
    }
    case "btn": {
      __updateTHREEJs__invoke__[$key]?.(input.value);
      return;
    }
    default: {
      console.log(`don't know the type: ${$meta4ctrl.type}`);
      break;
    }
  }

  let lastValue = $meta4ctrl.value;

  // syncronized !
  $meta4ctrl.value = $value;

  if ($meta4ctrl.eval) {
    __onControlsDOMChanged__?.({ [$key]: $value });
  }

  for (const k in __updateTHREEJs__many__) {
    if (k.split("_").includes($key)) {
      __updateTHREEJs__many__[k]($key, $value);
    }
  }

  if (Object.hasOwn(__updateTHREEJs__only__, $key)) {
    const res = __updateTHREEJs__only__[$key]($value);
    if (res !== undefined && res !== null) {
      if (res instanceof Promise) {
        input.disabled = true;
        res.then(
          () => {
            input.disabled = false;
          },
          () => {
            // revoke the value of input.
            __renderControls__({ [$key]: lastValue });
            input.disabled = false;
          }
        );
      } else if (!res) {
        __renderControls__({ [$key]: lastValue });
      }
    }
  } else {
    __updateTHREEJs__?.($key, $value);
  }

  __updateTHREEJs__after__?.();
};

const colorToHex = (color: number) => {
  return "#" + (color & 0xffffff).toString(16).padStart(6, "0").toUpperCase();
};
const hexToColor = (hex: string) => {
  return parseInt("0x" + hex.slice(1));
};

const _sd_ = new Date();
const timestamp2string = (ts: number) => {
  _sd_.setTime(ts);
  const yrs = _sd_.getFullYear() + "";
  const mon = _sd_.getMonth() + 1 + "";
  const date = _sd_.getDate() + "";
  return `${yrs}-${mon.padStart(2, "0")}-${date.padStart(2, "0")}`;
};

const $cDOM = (c: Control): HTMLDivElement => {
  const div = document.createElement("div");
  div.className = "Control";
  div.style.position = "relative";

  if (c.help) {
    const helptrigger = document.createElement("div");
    helptrigger.style.cssText = `width: 16px;
      height: 16px;
      flex-shrink: 0;
      background-color: white;
      color: rgb(0, 0, 0);
      border-radius: 50%;
      font-size: 14px;
      text-align: center;
      cursor: pointer;`;

    helptrigger.innerText = "?";
    div.appendChild(helptrigger);
    helptrigger.onclick = () => {
      createDialog({ width: c.helpWidth, title: "Help", content: c.help });
    };
  }

  const label = document.createElement("label");
  label.innerText = c.label;

  div.appendChild(label);

  switch (c.type) {
    case "date": {
      const input = document.createElement("input");
      input.name = c.name;
      input.type = "date";
      input.value = timestamp2string(c.value);
      console.log(timestamp2string(c.value));
      input.$meta4ctrl = c;
      input.onchange = $onchange;
      div.appendChild(input);
      break;
    }
    case "bit": {
      const input = document.createElement("input");
      input.name = c.name;
      input.type = "checkbox";
      input.$meta4ctrl = c;
      input.checked = c.value;
      input.onchange = $onchange;
      div.appendChild(input);
      break;
    }
    case "color": {
      const input = document.createElement("input");
      input.name = c.name;
      input.type = "color";
      input.value = colorToHex(c.value);
      input.$meta4ctrl = c;
      input.onchange = $onchange;
      div.appendChild(input);
      break;
    }
    case "enum": {
      const input = document.createElement("select");
      input.name = c.name;
      input.$meta4ctrl = c;

      for (const opt of c.options) {
        const optionEl = document.createElement("option");
        optionEl.value =
          opt.value === null ? selectCtrlNullishValueStr : opt.value;
        optionEl.label = opt.label;
        optionEl.selected = opt.value === c.value;
        input.options.add(optionEl);
      }

      input.onchange = $onchange;
      div.appendChild(input);

      const clearBtn = document.createElement("button");
      clearBtn.innerText = "x";
      clearBtn.className = "Control-select-clear-btn";
      clearBtn.onclick = () => {
        input.value = selectCtrlNullishValueStr;
        input.dispatchEvent(new Event("change"));
      };
      div.appendChild(clearBtn);
      break;
    }
    case "number": {
      const input = document.createElement("input");
      input.name = c.name;
      input.type = "number";
      input.value = c.value;
      input.$meta4ctrl = c;
      input.onchange = $onchange;
      div.appendChild(input);
      break;
    }
    case "string": {
      const input = document.createElement("input");
      input.name = c.name;
      input.type = "text";
      input.value = c.value;
      input.$meta4ctrl = c;
      input.onchange = $onchange;
      div.appendChild(input);
      break;
    }
    case "range": {
      const input = document.createElement("input");
      input.name = c.name;
      input.type = "range";
      input.step = "1";
      input.min = "0";
      input.max = "100";

      const text = document.createElement("div");
      text.style.fontSize = "0.6rem";
      text.style.width = "24px";
      text.style.textAlign = "left";
      text.style.pointerEvents = "none";

      const writeValue = (event: Event) => {
        let value = event ? rangeInputValueGet(input, c) : c.value;
        if (c.valueType === "int") {
          text.innerText = value + "";
        } else {
          text.innerText = value.toFixed(2);
        }
      };

      input.oninput = writeValue;

      rangeInputValueSet(input, c, c.value);

      input.$meta4ctrl = c;
      input.onchange = $onchange;
      div.appendChild(input);
      div.appendChild(text);

      writeValue(null);
      break;
    }
    case "btn": {
      const input = document.createElement("input");
      input.name = c.name;
      input.type = "button";
      input.value = "sig:" + c.value;
      input.$meta4ctrl = c;
      input.onclick = $onchange;
      div.appendChild(input);
      break;
    }
    default: {
      const span = document.createElement("span");
      span.innerText = `can't identify: ${c.type}`;
      div.appendChild(span);
      break;
    }
  }

  return div;
};

/**
 * @todo
 * @param c
 * @returns
 */
const $uDOM = (c: Control) => {
  if (!c.$el) return;

  switch (c.type) {
    case "color": {
      const input = c.$el.querySelector("input");
      input.value = colorToHex(c.value);
      break;
    }
    case "bit": {
      const input = c.$el.querySelector("input");
      input.checked = c.value;
      break;
    }
    case "range": {
      const input = c.$el.querySelector("input");
      rangeInputValueSet(input, c, c.value);
      break;
    }
    default: {
      break;
    }
  }
};

const controls: Record<string, Control> = {};

__defineControl__ = (<T>(
  name: string,
  type: ControlType,
  iniVal: any,
  extras: Partial<DefCtrlExtras<T>>
) => {
  controls[name] = {
    label: name,
    name,
    type,
    eval: true,
    ...extras,
    value: iniVal ?? null,
  };

  if (extras && extras.options) {
    extras.options.unshift({
      label: "<null />",
      value: null,
    });
  }
}) as DefineControl;

__defineControl__.rint = (min: number, max: number) => ({
  valueType: "int",
  min,
  max,
});
__defineControl__.rfloat = (min: number, max: number) => ({
  valueType: "number",
  min,
  max,
});
__defineControl__.r01 = () => ({ min: 0, max: 1, valueType: "number" });

let isUpdate = false;

__renderControls__ = (data: Record<string, any>) => {
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
      $uDOM(controls[k]);
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

const __onControlsDOMChanged__ = (data: Record<string, any>) => {
  for (const k in data) {
    const $v = data[k];
    const $t = typeof $v;
    if (
      $v !== null &&
      ($t === "object" ||
        $t === "undefined" ||
        $t === "symbol" ||
        $t === "function")
    ) {
      continue;
    } else {
      if ($t === "string") {
        __onControlsDOMChanged__iter__?.(`${k} = "${data[k]}";`, k, $v);
      } else {
        __onControlsDOMChanged__iter__?.(`${k} = ${data[k]};`, k, $v);
      }
    }
  }
};

//#region utils
const rangeCtrlValueGet = (meta: Control) => {
  const input = meta.$el.querySelector("input");
  return rangeInputValueGet(input, meta);
};

const rangeInputValueGet = (input: HTMLInputElement, meta: Control) => {
  const value = input.valueAsNumber; // 0 - 100
  const scale = (meta.max - meta.min) / 100;
  const actualValue = scale * value + meta.min;
  if (meta.valueType === "int") {
    return Math.floor(actualValue);
  } else {
    return actualValue;
  }
};

const rangeCtrlValueSet = (meta: Control, val: number) => {
  const input = meta.$el.querySelector("input");
  rangeInputValueSet(input, meta, val);
};

const rangeInputValueSet = (
  input: HTMLInputElement,
  meta: Control,
  val: number
) => {
  const scale = 100 / (meta.max - meta.min);
  const viewValue = scale * Math.max(0, val - meta.min);
  input.value = viewValue.toString();
  input.oninput?.(null);
};
//#endregion

export {};
