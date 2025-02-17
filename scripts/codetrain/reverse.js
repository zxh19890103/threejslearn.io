class Node {
  constructor(value) {
    this.value = value;
    this.next = null;
  }
}

class List {
  constructor() {
    this.head = null;
  }

  append(value) {
    const newNode = new Node(value);
    if (!this.head) {
      this.head = newNode;
    } else {
      let current = this.head;
      while (current.next) {
        current = current.next;
      }
      current.next = newNode;
    }
  }

  reverse() {
    return this;
  }

  print() {
    let current = this.head;
    let output = "";
    while (current) {
      output += `${current.value} -> `;
      current = current.next;
    }
    console.log(output + "null");
  }
}

//  1 -> 2 -> 3 -> 4 -> 5
const createList = (exp) => {
  const values = exp.split(/\s?->\s?/);
  const list = new List();
  for (const val of values) {
    list.append(val);
  }
  return list;
};

createList("1 -> 2 -> 3 -> 4 -> 5").reverse().print();
