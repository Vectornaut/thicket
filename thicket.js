// disable friendly error system to speed up execution
p5.disableFriendlyErrors = true;

// layout
let pop_base;
let nGens_base;
let hSep_base;
let scale;
let pop;
let nGens;
let hSep;
let vSep;

// mutations
let mutationRate_base;
let mutationRate;
let mutationRequests = null;

// under the saving throw mechanism, only the first `waist` cells from either
// edge are allowed to become empty
let waist_base;
let waist;

// generations
let shift = 1;
let birthCnt = 0;
let birthOrder;
let children;
let ancestors;
let scrolling = false;
let lift;
let scrolled = 0;

// tree buffers
let past;
let present;

// genealogy
let pastSources;
let presentSources;
let pastTraces;
let presentTraces;
let pastColors;
let presentColors;
const waiting = -1;
const requested = -2;

// lineage buffers
let lineage;

// colors
let bg;
let dark;
let light;
let empty;

// container and interaction
let canvasParent;
let clickAction;

function decideScrollBorders() {
  if (canvasParent.scrollWidth > canvasParent.clientWidth) {
    canvasParent.style.borderLeftColor = '#276b40';
  } else {
    canvasParent.style.borderLeftColor = 'transparent';
  }
  canvasParent.style.borderRightColor = canvasParent.style.borderLeftColor;
}

function readParam(name, defaultValue, nonNumerical) {
  if (canvasParent.hasAttribute(name)) {
    if (nonNumerical) return canvasParent.getAttribute(name);
    else return Number(canvasParent.getAttribute(name));
  } else {
    return defaultValue;
  }
}

function setMutationRate(newRate) {
  if (newRate != undefined) mutationRate_base = newRate;
  if (scale != undefined) mutationRate = mutationRate_base/(scale*scale);
}

function setParams() {
  // set layout
  pop = 1 + scale*pop_base;
  nGens = scale*scale*nGens_base;
  waist = scale*waist_base;
  
  // set mutation rate
  if (mutationRate_base == undefined) setMutationRate(readParam('mutation_rate', 1e-3));
  else setMutationRate();
  if (clickAction == 'mutate') {
    mutationRequests = Array(pop);
    for (let k = 0; k < pop; ++k) mutationRequests[k] = false;
  }
  
  // set spacing
  hSep = round(hSep_base/scale);
  vSep = round(hSep_base/(scale*scale) * 0.5 * sqrt(3));
  lift = vSep*(nGens-5);
}

function createBuffers() {
  // create tree buffers
  past = new Array(nGens-2);
  for (let n = 0; n < nGens-2; ++n) {
    past[n] = createGraphics(width, vSep);
  }
  present = createGraphics(width, 3*vSep);
  
  // adjust wrapper size
  document.getElementById('wrapper').style.maxWidth = (width + 2).toString() + 'px'; // add 2px for borders
  decideScrollBorders();
  background(bg);
  
  // create genealogy and lineage buffers
  if (canvasParent.hasAttribute('genealogy')) {
    // create genealogy
    pastSources = new Array(nGens);
    pastTraces = new Array(nGens);
    pastColors = new Array(nGens);
    for (let n = 0; n < nGens; ++n) {
      pastSources[n] = new Array(pop);
      pastTraces[n] = new Array(pop);
      pastColors[n] = new Array(pop);
      for (let k = 0; k < pop; ++k) pastColors[n][k] = empty;
    }
    presentSources = new Array(pop);
    presentTraces = new Array(pop);
    presentColors = new Array(pop);
    clearPresent();
    
    // create lineage buffers
    lineage = new Array(nGens);
    for (let n = 0; n < nGens; ++n) {
      lineage[n] = createGraphics(width, 2*vSep);
      lineage[n].strokeWeight(0.45*hSep);
    }
  } else {
    presentSources = null; // this signals that we're not recording genealogy
  }
  
  // make space for children
  children = new Array(pop);
  
  // initialize ancestors
  ancestors = new Array(pop+2);
  ancestors[0] = empty;
  for (let k = 0; k < pop; k++) {
    ancestors[k+1] = (abs(2*k - (pop-1)) <= 1) ? dark : empty;
    if (presentSources != null) {
      pastColors[nGens-1][k] = ancestors[k+1];
    }
  }
  ancestors[pop+1] = empty;
  
  // initialize birth order
  birthOrder = new Array(pop);
  for (let n = 0; n < pop; ++n) {
    birthOrder[n] = n;
  }
  shuffle(birthOrder, true);
  
  // set up buffers
  /*for (let n = 0; n < nGens-1; ++n) {
    past[n].background(150, 255, 0);
  }*/
  present.background(bg);
  present.fill(bg);
  present.strokeWeight(0.4*hSep);
}

function setup() {
  // get parent
  canvasParent = document.getElementById('thicket');
  
  // read parameters
  pop_base = readParam('pop', 120);
  nGens_base = readParam('ngens', 100);
  hSep_base = readParam('hsep', 8);
  waist_base = readParam('waist', 50);
  scale = readParam('scale', 1);
  clickAction = readParam('clickaction', 'none', true);
  
  // set parameters
  setParams();
  
  // set colors
  bg = color(0x7f, 0xb8, 0x8f);
  dark = color(0x0);
  light = color(0xff);
  empty = color(0x80);
  
  // set up canvas
  let canvas = createCanvas(hSep*(pop + 0.5), vSep*nGens);
  canvas.parent('thicket');
  window.addEventListener('resize', decideScrollBorders);
  frameRate(30);
  
  // create buffers
  createBuffers();
}

function reset() {
  setParams();
  resizeCanvas(hSep*(pop + 0.5), vSep*nGens, true);
  createBuffers();
  
  // reset animation
  shift = 1;
  birthCnt = 0;
  scrolling = false;
  scrolled = 0;
}

function rescale(newScale) {
  scale = newScale;
  reset();
}

function draw() {
  // draw new children
  drawChildren(ceil((scrolled/vSep)*pop));
  
  // if a generation has passed, roll over to the next one
  if (scrolled == vSep) {
    // advance buffers
    advanceBuffers();
    
    // advance genealogy
    if (presentSources != null) {
      pastSources.push(presentSources);
      presentSources = pastSources.shift();
      pastTraces.push(presentTraces);
      presentTraces = pastTraces.shift();
      pastColors.push(presentColors);
      presentColors = pastColors.shift();
      clearPresent();
    }
    
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
  
  // paint the tree buffers onto the screen
  log('paint tree buffers');
  for (let n = 0; n < nGens-2; ++n) {
    image(past[n], 0, n*vSep - (lift + scrolled));
  }
  image(present, 0, (nGens-2)*vSep - (lift + scrolled));
  
  // paint the lineage buffers onto the screen
  log('paint lineages');
  if (presentSources != null) {
    for (let n = 0; n < nGens; ++n) {
      image(lineage[n], 0, (n-1)*vSep - (lift + scrolled));
    }
  }
  
  // move the buffer image
  if (lift > 0) --lift;
  ++scrolled;
}

function mouseClicked() {
  if (0 <= mouseY && 0 <= mouseX && mouseX < width) {
    // map click to site
    let n = min(nGens, round((mouseY + lift + scrolled)/vSep + 0.5));
    let hShift = (n - nGens) % 2 ? 1-shift : shift;
    let k = round(mouseX/hSep - 0.5*hShift - 0.5);
    
    console.log('click in bounds. click action: ', clickAction);
    if (clickAction == 'lineage' && presentSources != null) {
      console.log('draw lineage');
      if (keyIsDown(SHIFT)) {
        // clear lineages and traces
        for (let n = 0; n < nGens; ++n) {
          lineage[n].clear();
          for (let k = 0; k < pop; ++k) pastTraces[n][k] = false;
        }
        for (let k = 0; k < pop; ++k) presentTraces[k] = false;
      } else {
        // draw lineage
        if (0 <= k && k < pop) {
          if (n >= nGens && presentSources[k] < 0) {
            presentSources[k] = requested;
          } else {
            drawLineage(k, n);
          }
        }
      }
    } else if (clickAction == 'mutate' && n >= nGens) {
      mutationRequests[k] = true;
    }
  }
}

function clearPresent() {
  for (let k = 0; k < pop; ++k) {
    presentSources[k] = waiting;
    presentTraces[k] = false;
  }
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
  present.rect(0, vSep, present.width, 2*vSep);
  
  // advance lineage buffers
  if (presentSources != null) {
    lineage[0].clear();
    lineage.push(lineage.shift());
  }
}

function varyColor(c, takeRequest) {
  if (random() < mutationRate || takeRequest) {
    return c == dark ? light : dark;
  } else {
    return c;
  }
}

function bicolorLine(x1, y1, c1, x2, y2, c2) {
  x_mid = lerp(x1, x2, 0.5);
  y_mid = lerp(y1, y2, 0.5);
  present.stroke(c1);
  present.line(x1, y1, x_mid, y_mid);
  present.stroke(c2);
  present.line(x_mid, y_mid, x2, y2);
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
      let takeRequest = false;
      if (mutationRequests != null) takeRequest = mutationRequests[next];
      children[next] = varyColor(ancestors[src], takeRequest);
      bicolorLine(
        hSep*(next + 0.5*shift + 0.5), vSep*1.5, lerpColor(children[next], bg, 0.65*(presentSources != null)),
        hSep*(src + 0.5*(1-shift) - 0.5), vSep*0.5, lerpColor(ancestors[src], bg, 0.65*(presentSources != null))
      );
    }
    
    // record source (without index padding) and color
    if (presentSources != null) {
      let takeRequest = presentSources[next] == requested && children[next] != empty;
      presentSources[next] = src-1;
      presentColors[next] = children[next];
      if (takeRequest) drawLineage(next);
    }
    
    // clear mutation request
    mutationRequests[next] = false;
  }
}

function drawLineage(head, n) {
  let src;
  let traced;
  let hShift;
  let headColor;
  let srcColor;
  if (n >= nGens || n === undefined) {
    headColor = presentColors[head];
    src = presentSources[head];
    traced = presentTraces[head];
    presentTraces[head] = true;
    hShift = shift;
    n = nGens-1;
  } else {
    headColor = pastColors[n][head];
    src = pastSources[n][head];
    traced = pastTraces[n][head];
    pastTraces[n][head] = true;
    hShift = (n - nGens) % 2 ? 1-shift : shift;
    --n;
  }
  if (headColor != empty) {
    lineage[n].stroke(headColor);
    for (; n > 0 && !traced && src >= 0 && pastColors[n][src]; --n) {
      // get source color
      srcColor = pastColors[n][src];
      
      // draw line of descent
      let x1 = hSep*(head + 0.5*hShift + 0.5);
      let x2 = hSep*(src + 0.5*(1-hShift) + 0.5);
      x_mid = lerp(x1, x2, 0.5);
      lineage[n].stroke(headColor);
      lineage[n].line(x1, 1.5*vSep, x_mid, vSep);
      lineage[n].stroke(srcColor);
      lineage[n].line(x_mid, vSep, x2, 0.5*vSep);
      
      // step to previous generation
      head = src;
      headColor = srcColor;
      src = pastSources[n][head];
      traced = pastTraces[n][head];
      pastTraces[n][head] = true;
      hShift = 1-hShift;
    }
  }
}
