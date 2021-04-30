// disable friendly error system to speed up execution
p5.disableFriendlyErrors = true;

// layout
/*const pop = 61;
const nGens = 50;
const hSep = 16;*/
const pop = 121;
const nGens = 100;
const hSep = 8;
let vSep;
/*final int scrollStep = 1;*/

// under the saving throw mechanism, only the first `waist` cells from either
// edge are allowed to become empty
/*const waist = 25;*/
const waist = 50;

// generations
let shift = 1;
let birthCnt = 0;
let birthOrder = new Array(pop);
let children = new Array(pop);
let ancestors = new Array(pop+2);
let scrolling = false;
let lift;
let scrolled = 0;

// buffers
let past = new Array(nGens-2);
let present;

// colors
let bg;
let dark;
let light;
let empty;

// container
let canvasParent;

function decideScrollBorders() {
  if (canvasParent.scrollWidth > canvasParent.clientWidth) {
    canvasParent.style.borderLeftColor = '#276b40';
  } else {
    canvasParent.style.borderLeftColor = 'transparent';
  }
  canvasParent.style.borderRightColor = canvasParent.style.borderLeftColor;
}

function setup() {
  // set row spacing
  vSep = round(hSep * 0.5 * sqrt(3));
  lift = vSep*(nGens-5);
  
  // create canvas and buffers
  let canvas = createCanvas(hSep*(pop + 0.5), vSep*nGens);
  for (let n = 0; n < nGens-2; ++n) {
    past[n] = createGraphics(width, vSep);
  }
  present = createGraphics(width, 3*vSep);
  
  // initialize ancestors
  dark = color(0x0);
  light = color(0xff);
  empty = color(0x80);
  ancestors[0] = empty;
  for (let n = 0; n < pop; n++) {
    ancestors[n+1] = (abs(2*n - (pop-1)) <= 1) ? dark : empty;
  }
  ancestors[pop+1] = empty;
  
  // initialize birth order
  for (let n = 0; n < pop; ++n) {
    birthOrder[n] = n;
  }
  shuffle(birthOrder, true);
  
  // set up canvas
  bg = color(0x7f, 0xb8, 0x8f); // dustier sage
  canvas.parent('thicket');
  canvasParent = canvas.parent();
  document.getElementById('wrapper').style.maxWidth = (canvas.width + 2).toString() + 'px'; // add 2px for borders
  decideScrollBorders();
  window.addEventListener('resize', decideScrollBorders);
  background(bg);
  frameRate(30);
  
  // set up buffers
  /*for (let n = 0; n < nGens-1; ++n) {
    past[n].background(150, 255, 0);
  }*/
  present.background(bg);
  present.fill(bg);
  present.strokeWeight(0.4*hSep);
}

function draw() {
  // draw new children
  drawChildren(ceil((scrolled/vSep)*pop));
  
  // if a generation has passed, roll over to the next one
  if (scrolled == vSep) {
    // advance buffers
    advanceBuffers();
    
    // yesterday's children are today's ancestors. note that `ancestors` is
    // padded with empty boundary cells at 0 and `pop+1`.
    for (let n = 0; n < pop; ++n) {
      ancestors[n+1] = children[n];
    }
    
    // toggle row shift
    shift = 1-shift;
    
    // reset birth cycle
    shuffle(birthOrder, true);
    birthCnt = 0;
    
    // reset scroll
    scrolled = 0;
  }
  
  // paint the buffers onto the screen
  for (let n = 0; n < nGens-2; ++n) {
    image(past[n], 0, n*vSep - (lift + scrolled));
  }
  image(present, 0, (nGens-2)*vSep - (lift + scrolled));
  
  // move the buffer image
  if (lift > 0) --lift;
  ++scrolled;
}

function advanceBuffers() {
  // return the top `past` buffer to the bottom of the stack, and copy the top
  // half of `present` into it
  past[0].copy(
    present,
    0, 0, present.width, vSep,
    0, 0, present.width, vSep
  );
  past.push(past.shift());
  
  // advance `present`
  present.copy(
    0, vSep, present.width, vSep,
    0, 0, present.width, vSep
  );
  present.noStroke();
  present.rect(0, vSep, present.width, vSep);
}

function varyColor(c) {
  if (random(0, 1) < canvasParent.getAttribute('mutation_rate')) {
    return c == dark ? light : dark;
  } else {
    return c;
  }
}

const nSegs = 2;

function gradLine(x1, y1, c1, x2, y2, c2) {
  let tLast;
  let t = 0;
  for (let n = 0; n < nSegs; ++n) {
    tLast = t;
    t = (n+1)/nSegs;
    present.stroke(lerpColor(c1, c2, (n)/(nSegs-1)));
    present.line(
      lerp(x1, x2, tLast), lerp(y1, y2, tLast),
      lerp(x1, x2, t), lerp(y1, y2, t)
    );
  }
}

function drawChildren(until) {
  // generate children
  for (; birthCnt < until; ++birthCnt) {
    // see where the next child will be born, and choose its ancestor. note that
    // `ancestors` is padded with empty boundary cells at 0 and `pop+1`
    let next = birthOrder[birthCnt];
    let choice = floor(random(2));
    let src = 1 + next + shift - choice;
    
    // if the chosen ancestor is empty, do a saving throw
    let saveDifficulty = next < 0.5*(pop-1) ? 1 - next/waist
                                            : 1 - (pop-1 - next)/waist;
    if (ancestors[src] == empty && random() > saveDifficulty) {
      src += 2*choice - 1;
    }
    
    // pick the child's color. draw it, unless it's empty
    if (ancestors[src] == empty) {
      children[next] = empty;
    } else {
      children[next] = varyColor(ancestors[src]);
      gradLine(
        hSep*(next + 0.5*shift + 0.5), vSep*1.5, children[next],
        hSep*(src + 0.5*(1-shift) - 0.5), vSep*0.5, ancestors[src]
      );
    }
  }
}
