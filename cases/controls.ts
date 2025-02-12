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
      switch ($meta4ctrl.valueType) {
        case "string":
          $value = select.value;
          break;
        case "number":
          $value = Number(select.value);
          break;
        case "bit":
          $value = select.value === "0" ? false : true;
          break;
      }
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
      const scale = ($meta4ctrl.max - $meta4ctrl.min) / 100;
      $value = scale * input.valueAsNumber;
      if ($meta4ctrl.valueType === "int") {
        $value = Math.floor($value);
      }
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

  __onControlsDOMChanged__?.({
    [$key]: $value,
  });

  if (Object.hasOwn(__updateTHREEJs__only__, $key)) {
    __updateTHREEJs__only__[$key]($value);
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

const $cDOM = (c: Control): HTMLDivElement => {
  const div = document.createElement("div");
  div.className = "Control";
  div.style.position = "relative";

  const label = document.createElement("label");
  label.innerText = c.label;

  div.appendChild(label);

  switch (c.type) {
    case "bit": {
      const input = document.createElement("input");
      input.name = c.name;
      input.type = "checkbox";
      input.$meta4ctrl = c;
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

      c.options.forEach((opt) => {
        const optionEl = document.createElement("option");
        optionEl.value = opt.value;
        optionEl.label = opt.label;
        optionEl.selected = opt.value === c.value;
        input.options.add(optionEl);
      });

      input.onchange = $onchange;
      div.appendChild(input);
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

      const span = document.createElement("span");
      span.style.position = "absolute";
      span.style.right = "0px";
      span.style.top = "50%";
      span.style.transform = `translate(100%, -50%)`;
      span.style.fontSize = "0.6rem";
      span.style.pointerEvents = "none";

      div.appendChild(span);
      input.oninput = () => {
        const scale = (c.max - c.min) / 100;
        const val = scale * input.valueAsNumber;
        span.innerText = (
          c.valueType === "int" ? Math.floor(val) : val
        ).toFixed(2);
      };

      const scale = 100 / (c.max - c.min);
      input.value = "" + scale * c.value;

      input.$meta4ctrl = c;
      input.onchange = $onchange;
      div.appendChild(input);
      break;
    }
    case "btn": {
      const input = document.createElement("input");
      input.name = c.name;
      input.type = "button";
      input.value = "val:" + c.value;
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

__defineControl__ = <T>(
  name: string,
  type: ControlType,
  iniVal: any,
  extras: Partial<DefCtrlExtras<T>>
) => {
  controls[name] = {
    label: name,
    name,
    type,
    ...extras,
    value: iniVal ?? null,
  };
};

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
        __onControlsDOMChanged__iter__?.(`${k} = "${data[k]}";`, k, $v);
      } else {
        __onControlsDOMChanged__iter__?.(`${k} = ${data[k]};`, k, $v);
      }
    }
  }
};

export {};
