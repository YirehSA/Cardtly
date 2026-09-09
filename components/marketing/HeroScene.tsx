import Link from 'next/link'
import HeroSceneLoader from './HeroSceneLoader'

// The scroll-driven hero.
//
// A SERVER component on purpose. The markup and the 26KB stylesheet are
// static, so shipping them from the server keeps them out of the JS bundle and
// puts the hero's own critical CSS in the first response, which is what lets
// the poster and the copy paint before any script has arrived.
// HeroSceneLoader is the one client piece, and it renders nothing.
//
// The stylesheet is the delivered one, with four edits and no others:
//
//   - the custom properties moved from :root onto .hero-scroll, because the
//     site has its own --muted and --line and these were about to sit on them
//   - the html,body reset dropped, since it belongs to a standalone file and
//     would have repainted the whole document in the hero's near-black
//   - the font moved from body onto .hero-scroll rather than removed. Every
//     line length in the portrait layout is derived from measured em widths in
//     that exact stack, so putting the hero on the site's Jakarta would
//     invalidate the arithmetic the responsive treatment is built on
//   - the bare `*`, `a` and second `:root` selectors scoped the same way
//
// Everything else, including the comments explaining why each number is what
// it is, is untouched.

const CSS = `/* Scoped to the section rather than :root. Every one of these is read by a
     descendant of .hero-scroll, and the site has its own --muted and --line at
     :root that these would sit on top of. */
  .hero-scroll{
    color-scheme: dark;
    --ground:#08080b; --surface:#12121a; --raised:#1b1b26;
    --cyan:#38bdf8; --blue:#3b82f6; --violet:#8b5cf6; --magenta:#d946ef;
    --text:#ffffff; --muted:#a1a1aa; --line:rgba(255,255,255,.09);
    --shell:1240px;
    /* The one number this file did not have to know as a standalone fragment.
       Cardtly's Navbar is fixed at the top and 5rem tall, so in portrait -
       where the copy is anchored to the top of the stage rather than centred
       in it - the header sat over the first line of the headline by 64px.
       Landscape centres the copy and needs no allowance.
       Matches h-20 on the header in components/marketing/Navbar.tsx. */
    --ct-header:5rem;
  }
  /* And 6rem from lg up, because the header takes lg:pt-4 there. Same
     breakpoint as Tailwind's lg, written as a plain query because this
     stylesheet is not run through Tailwind. If one of these two moves without
     the other, the headline goes back under the bar on a short laptop. */
  @media (min-width:1024px){ .hero-scroll{--ct-header:6rem} }
  .hero-scroll *{box-sizing:border-box}
  /* html,body reset dropped: it belongs to the standalone file, not to a page
     that already has a background and a body font of its own. */
  .hero-scroll{font:400 16px/1.6 Outfit,"Century Gothic",system-ui,-apple-system,"Segoe UI",sans-serif;
       -webkit-font-smoothing:antialiased}
  .hero-scroll a{color:inherit}

  /* ---------- the hero, as it ships ---------- */
  /* 5.4 viewports of travel, down from 10.2 and then from 7.8. Shorter, and
     yet MORE happens
     per unit of scroll, because the timeline no longer contains dead zones:
     the old cut spent its first 0.08 with every channel parked, which at that
     length was 700px of scrolling that changed nothing, and the fix for "I
     scroll twice before anything moves" is to remove the nothing rather than
     to shorten the something. Pace still comes from CONTRAST: the turn to the
     back takes half the timeline, the flip back takes a sixth. */
  .hero-scroll{position:relative;height:640vh}
  /* HALF THE TRAVEL ON A PHONE, which is the whole of "twice as fast": the
     timeline is a function of how far through this section the page has
     scrolled, so the same piece over half the distance plays at double the
     rate. Nothing in the animation is retimed, so every window, clearance and
     overlap it was tuned against is unchanged.
     Phones earn it. A thumb swipe moves a fraction of what a trackpad flick
     does, and 6.4 screens of scrolling to see one hero is a piece most people
     will leave in the middle of. 4 screens rather than 3.2: halving it was a
     touch brisk, and the tap in particular went past before it landed. */
  @media (max-aspect-ratio: 1/1){ .hero-scroll{height:400vh} }
  /* The stage carries the poster's ground as a CSS gradient, so the FIRST
     style pass paints something. A data-URI poster still has to be decoded
     before it can be shown, which measured at 888ms on a cold open, and until
     then the page was black. A gradient costs nothing and is painted with the
     first frame the browser produces, so the sequence is now colour, then
     poster, then the live scene, with no blank step at the front of it. */
  /* svh, NOT vh, and on a phone this is the difference between a composition
     and a crop. A mobile browser's vh unit is the LARGE viewport: it measures
     the page as if the address bar and the tab strip were retracted, which
     they are not when the page first opens. A sticky stage at 100vh therefore
     runs about 110px past the bottom of what anyone can actually see, and the
     bottom of the picture, which is where the card sits, is under the browser
     chrome. That is exactly what the client's screenshot showed.
     svh is the SMALL viewport, the height that is visible with the chrome
     out, so the stage is fully on screen at every moment instead of only
     after a scroll. vh stays as the fallback for browsers without it. */
  .hero-stage{position:sticky;top:0;height:100vh;height:100svh;overflow:hidden;
              display:grid;place-items:center;
              background:
                radial-gradient(70% 55% at 62% 42%, #14122b 0%, transparent 62%),
                radial-gradient(60% 50% at 24% 70%, #0d1430 0%, transparent 66%),
                linear-gradient(180deg, #090911 0%, #0b0a16 55%, #08080e 100%)}
  .hero-stage::before{
    content:"";position:absolute;inset:0;z-index:0;pointer-events:none;
    background:
      /* Held right down now that the scene carries its own aurora, which has
         parallax and these do not. Two washes stacked was one too many. */
      radial-gradient(58% 48% at 66% 62%, rgba(139,92,246,.07), transparent 70%),
      radial-gradient(46% 40% at 28% 38%, rgba(56,189,248,.05), transparent 70%),
      radial-gradient(70% 55% at 50% 108%, rgba(217,70,239,.05), transparent 70%);
  }
  #hero-gl{position:absolute;inset:0;width:100%;height:100%;z-index:1}
  .hero-poster{position:absolute;inset:0;width:100%;height:100%;z-index:1;
               object-fit:cover;pointer-events:none;
               transition:opacity .5s ease}
  .hero-poster.is-gone{opacity:0}

  /* The scroll-driven nudge arrives as --shift and is COMPOSED here, never
     written to style.transform. Writing that property replaces the whole
     declaration, so on a wide frame it would drop the -50% centring and on a
     tall one it would reintroduce one that the layout does not want. Each
     breakpoint composes the offset with whatever transform it needs. */
  .hero-copy{position:absolute;z-index:2;width:min(52ch,46vw);
             top:50%;
             transform:translateY(calc(-50% - 3.2rem + var(--shift,0px)))}
  /* Pulled further left and lifted, so the column sits closer to the frame
     edge and above the model's centre line rather than level with it. The
     lift rides on the SAME composed transform as the scroll shift, because
     writing to style.transform would replace it. */
  .hero-copy--left{left:max(1.25rem,calc((100vw - var(--shell))/2 - 1.75rem))}
  .hero-copy--right{right:max(2rem,calc((100vw - var(--shell))/2 + 1rem));
                    text-align:right}
  /* THE CLOSING BLOCK STARTS HIDDEN, and this is a deliberate exception to
     the rule that content never defaults to invisible.
     The two copy blocks are not two pieces of content, they are the FIRST and
     LAST frames of one animation, absolutely positioned over each other.
     Leaving both visible until the script arrives meant that for the whole
     load the hero showed two headlines stacked on top of each other, which is
     what the client saw. The opening block is the one that pairs with the
     loading poster, so it is the one that stays.
     Nothing is unreachable as a result: the closing block restates the
     opening one, its call to action is the same, and the <noscript> below
     puts it back into the flow for a browser that genuinely has no script. */
  .hero-copy--right{opacity:0}
  .hero-beat{opacity:0}
  .ct-js .hero-copy{will-change:opacity,transform}
  .hero-copy h1,.hero-copy h2{
    margin:0 0 1.15rem;font-weight:800;letter-spacing:-.035em;
    font-size:clamp(2.4rem,5.55vw,4.75rem);line-height:.98}
  /* The closing block's longest line is "You are saved.", two characters
     longer than anything in the h1, and at the h1's size with nowrap on it
     ran straight off the right of the frame. A non-wrapping line has no
     safety valve, so the size has to be chosen to fit rather than left to
     the browser to sort out. */
  /* BIGGER THAN THE H1 IN POINTS, and the same size on the page. The two
     blocks are set to match by LINE LENGTH rather than by font size, because
     that is what the eye compares: the h1's longest line is "More meetings."
     at 8.33em and the h2's is "Followed up." at 6.75em, so equal measures put
     the h2 about a quarter larger in points. 6.6vw against the h1's 5.55vw
     lands just under that, which keeps the h1 the widest line on the page
     while giving the payoff the weight it was missing. */
  .hero-copy h2{font-size:clamp(2.8rem,6.6vw,5.6rem)}
  /* Each line is its own non-wrapping span. The h1 already carried explicit
     line breaks and STILL set as four lines, because "More meetings." was
     wider than the column and wrapped inside its own line. Explicit breaks
     only decide where lines END; they cannot stop one from splitting.

     WIDTH:MAX-CONTENT, and this is a real defect it fixes rather than tidiness.
     A .ln is a block, so it took the column's width, and a nowrap line longer
     than the column simply overflowed it. White text does not care. A GRADIENT
     one does: background-clip:text paints the gradient over the element's own
     box, so every glyph past the column's edge had no background to be clipped
     from and was painted with nothing. The closing heading read "Followed u"
     with the last 76px of it invisible. Sizing each line to its own text makes
     the paint box and the text the same thing, at which point a gradient can
     never run out part way through a word. */
  .hero-copy h1 .ln,.hero-copy h2 .ln{display:block;white-space:nowrap;
                                      width:max-content;max-width:100vw}
  /* max-content blocks are placed at the start of the line box, so the closing
     column needs them pushed back to its right edge; text-align cannot do it,
     because the box is now exactly as wide as its text. */
  .hero-copy--right h2 .ln{margin-left:auto}
  .grad{background:linear-gradient(97deg,var(--cyan),var(--violet) 52%,var(--magenta));
        -webkit-background-clip:text;background-clip:text;color:transparent}
  .hero-copy p{margin:0 0 1.75rem;color:#c3c3cc;
               font-size:clamp(1.02rem,1.45vw,1.22rem);max-width:40ch;
               line-height:1.55}
  .hero-copy--right p{margin-left:auto}
  .btn-row{display:flex;gap:.75rem;flex-wrap:wrap}
  .hero-copy--right .btn-row{justify-content:flex-end}
  /* ---------- buttons ----------
     The hover is built from four things that move on DIFFERENT clocks, which
     is what separates a premium control from a colour swap: a light that
     follows the cursor across the face, the brand gradient travelling under
     the label, a slow sheen crossing once, and the arrow unfolding. Every
     duration is longer than the usual 150ms and every curve is the same
     decelerating one, so the button settles rather than snapping.

     --mx and --my are written by preview.js from the pointer position. They
     have resting values here, so a button with no script still hovers
     correctly; the cursor light simply stays centred. */
  .btn{display:inline-flex;align-items:center;gap:.55rem;
       padding:.95rem 1.75rem;border-radius:999px;border:1px solid transparent;
       font-weight:700;font-size:1.02rem;letter-spacing:-.01em;
       text-decoration:none;position:relative;overflow:hidden;isolation:isolate;
       --mx:50%;--my:50%;
       transition:transform .46s cubic-bezier(.16,.84,.28,1),
                  box-shadow .46s cubic-bezier(.16,.84,.28,1),
                  border-color .46s ease}
  /* The cursor light. Its own layer so it can fade independently of the
     gradient underneath, and pointer-events off so it never eats the hover. */
  .btn__lume{position:absolute;inset:0;z-index:1;pointer-events:none;
             border-radius:inherit;opacity:0;
             background:radial-gradient(circle 120px at var(--mx) var(--my),
               rgba(255,255,255,.30),transparent 62%);
             transition:opacity .5s cubic-bezier(.16,.84,.28,1)}
  .btn:hover .btn__lume,.btn:focus-visible .btn__lume{opacity:1}
  .btn__label{position:relative;z-index:3;display:inline-block;
              transition:transform .46s cubic-bezier(.16,.84,.28,1)}
  /* The arrow is folded away at rest and unfolds on hover, so the button gains
     a word's worth of width without the row reflowing: max-width animates, the
     layout does not. */
  .btn__go{position:relative;z-index:3;display:inline-block;overflow:hidden;
           max-width:0;opacity:0;transform:translateX(-8px);
           transition:max-width .48s cubic-bezier(.16,.84,.28,1),
                      opacity .36s ease,transform .48s cubic-bezier(.16,.84,.28,1)}
  .btn:hover .btn__go,.btn:focus-visible .btn__go{max-width:1.4em;opacity:1;
                                                  transform:translateX(0)}

  .btn--primary{color:#fff;
    background:linear-gradient(97deg,var(--blue),var(--violet) 55%,var(--magenta));
    background-size:210% 100%;background-position:0% 0;
    transition:transform .46s cubic-bezier(.16,.84,.28,1),
               box-shadow .46s cubic-bezier(.16,.84,.28,1),
               background-position .9s cubic-bezier(.16,.84,.28,1)}
  /* The gradient TRAVELS on hover rather than the button changing colour, so
     the brand ramp reads as one continuous thing being moved under a window. */
  .btn--primary:hover,.btn--primary:focus-visible{
    background-position:100% 0;transform:translateY(-3px);
    box-shadow:0 16px 44px -10px rgba(139,92,246,.78),
               0 4px 14px -6px rgba(56,189,248,.55),
               0 0 0 1px rgba(255,255,255,.14) inset}
  /* Effect 01, shine. background-repeat must be no-repeat or the sheen tile
     repeats back across the button and shows at rest. */
  .btn--primary::after{
    content:"";position:absolute;inset:0;z-index:1;pointer-events:none;
    background:linear-gradient(115deg,transparent 35%,rgba(255,255,255,.46) 50%,transparent 65%);
    background-size:250% 250%;background-position:200% 0;background-repeat:no-repeat;
    transition:background-position 1.05s cubic-bezier(.16,.84,.28,1)}
  .btn--primary:hover::after,.btn--primary:focus-visible::after{background-position:-40% 0}

  .btn--ghost{background:rgba(255,255,255,.04);border-color:var(--line);color:#fff}
  /* A ring that grows from the centre instead of a border colour change. */
  .btn--ghost::before{
    content:"";position:absolute;inset:0;z-index:0;border-radius:inherit;
    background:radial-gradient(120% 180% at 50% 130%,
               rgba(56,189,248,.34),rgba(139,92,246,.16) 45%,transparent 72%);
    opacity:0;transform:scale(.7);
    transition:opacity .34s ease,transform .44s cubic-bezier(.2,.8,.3,1)}
  .btn--ghost:hover,.btn--ghost:focus-visible{
    border-color:rgba(56,189,248,.55);transform:translateY(-2px);
    box-shadow:0 10px 30px -12px rgba(56,189,248,.6)}
  .btn--ghost:hover::before,.btn--ghost:focus-visible::before{opacity:1;transform:scale(1)}
  .btn:active{transform:translateY(-1px) scale(.982);
              transition-duration:.12s}
  .btn:focus-visible{outline:2px solid var(--cyan);outline-offset:3px}
  @media (prefers-reduced-motion:reduce){
    .btn,.btn__label,.btn__go,.btn--primary,.btn--ghost::before,
    .btn--primary::after,.btn__lume{transition:none}
  }
  /* ---------- the ticks, which are the block's only idle motion ----------
     Everything else in the hero waits for scroll, so with the page held still
     the copy column was completely inert. Rather than add a decoration, the
     two feature lines that were already there do the work: each one's mark
     DRAWS ITSELF as a check, a ring pulses out from behind it, and the label
     lifts a shade brighter, staggered so they read one after the other on a
     slow loop rather than blinking together.

     Nothing here starts invisible. The check's resting state is drawn and the
     label's resting state is legible; the animation moves them ABOVE that, so
     with animations off, under reduced motion, or with no script at all, the
     lines still read exactly as written. */
  .ticks{display:flex;gap:1.35rem;flex-wrap:wrap;margin-top:1.4rem;
         color:var(--muted);font-size:.92rem}
  .hero-copy--right .ticks{justify-content:flex-end}
  .ticks span{position:relative;display:inline-flex;align-items:center;
              gap:.5rem;color:var(--muted);
              animation:tick-label 5.2s ease-in-out infinite}
  .ticks svg{flex:none;width:17px;height:17px;overflow:visible}
  /* The ring is a circle that scales out and fades, drawn behind the check. */
  .ticks .ring{fill:none;stroke:var(--cyan);stroke-width:1.4;opacity:0;
               transform-origin:50% 50%;
               animation:tick-ring 5.2s ease-out infinite}
  /* 22 is a little over the path's own length, so a dashoffset of 22 hides it
     entirely and 0 shows it whole. */
  .ticks .mark{fill:none;stroke:var(--cyan);stroke-width:1.9;
               stroke-linecap:round;stroke-linejoin:round;
               stroke-dasharray:22;stroke-dashoffset:0;
               animation:tick-draw 5.2s cubic-bezier(.5,0,.15,1) infinite}
  .ticks span:nth-child(2) *,.ticks span:nth-child(2){animation-delay:.42s}
  @keyframes tick-draw{
    0%{stroke-dashoffset:22}
    14%,100%{stroke-dashoffset:0}}
  @keyframes tick-ring{
    0%{opacity:.55;transform:scale(.45)}
    26%{opacity:0;transform:scale(1.5)}
    100%{opacity:0;transform:scale(1.5)}}
  @keyframes tick-label{
    0%,30%{color:#e7e7ee}
    52%,100%{color:var(--muted)}}

  /* The two beats are sequential, not stacked, so they share ONE grid cell
     and cross-fade in place. Left in normal flow, the second heading would
     appear in the gap below where the first one used to be. */
  .hero-beats{position:absolute;z-index:2;left:max(2rem,calc((100vw - var(--shell))/2 + 1rem));
              top:50%;transform:translateY(-50%);width:min(22rem,28vw);
              display:grid;align-items:center}
  /* A HEADLINE, not a caption. It carries the middle of the piece on its own
     now that there is one of them instead of two, so it is sized and weighted
     to match the blocks either side of it rather than sitting under them. */
  /* The entry offset arrives as --shift and is COMPOSED, for the same reason
     the copy blocks compose theirs: writing style.transform from script would
     replace whatever the stylesheet needs here. */
  .hero-beat{grid-area:1/1;margin:0;font-size:clamp(2.1rem,4.2vw,3.4rem);
             font-weight:800;line-height:1.02;letter-spacing:-.03em;color:#fff;
             transform:translateY(var(--shift,0px))}
  .hero-beat .ln{display:block;white-space:nowrap}
  /* Hidden until the script drives it, for the same reason the closing block
     is and it is the same bug: this is a frame of the animation, absolutely
     positioned over the opening block, and left visible by default it sat
     across the h1 by 352x111px for the whole load. The <noscript> at the top
     of the body takes it out of the layout entirely. */
  .hero-beat{opacity:0}
  .ct-js .hero-beat{will-change:opacity,transform}

  @media (max-aspect-ratio: 1/1){
    /* ---------- portrait ----------
       THE HEADLINE IS SIZED FROM THE COLUMN, not from a viewport guess, and
       that is the correction the client's screenshot forced twice over.
       A clamp is a guess about how wide the text will set: at clamp(2.7rem,
       10.4vw, 4.1rem) the line "More meetings." measured 359.9px inside a
       350px column on a 390px frame, so the longest line in the hero was
       running off the side of it. Shrinking the clamp until it fits is the
       wrong repair too, because it sizes every phone for the narrowest one.

       Each line is nowrap, so the constraint is exact and arithmetic: the
       longest line of the h1 is 8.33em wide, measured, and 8.67 is that with
       four percent of margin on it. Dividing the column by that number is the
       largest size that provably fits at ANY width, and it grows with the
       screen instead of stopping at a breakpoint. The h2 and the beat get
       their own divisors because their longest lines are shorter, which is
       why the closing heading and the mid-animation beat set larger than the
       h1 rather than all three being held down to the worst case.

       The model below is not fitted by hand against this. It reads the copy
       column's measured height at runtime, so the two can never collide and
       there can never be a band of nothing between them (see setCopyReserve
       in animation.js). */
    .hero-scroll{--hpad:clamp(1rem,4.2vw,2.5rem)}
    .hero-copy{position:absolute;top:0;left:0;right:0;width:auto;
               transform:translateY(var(--shift,0px));
               padding:calc(1.05rem + var(--ct-header,0px)) var(--hpad) 0;text-align:left}
    .hero-copy--right{text-align:left}
    .hero-copy--right p,.hero-copy--right .btn-row,.hero-copy--right .ticks{
      margin-left:0;justify-content:flex-start}
    /* SIZED FROM THE VIEWPORT HEIGHT, capped by the column, and there is only
       one portrait treatment now.
       There used to be a second one below 600px carrying a wrapped six-line
       headline, and that breakpoint was a cliff: the same page was six big
       lines at 599px and three small ones at 600px. A phone found the far
       side of it in the worst way possible. Opened as a bare fragment with
       nothing declaring a viewport, Android lays the page out at 980px and
       scales the result down, so the phone took the wide branch and drew it
       at a third of its size; that is what the client photographed.
       Height is the right measure because the brief is a title that takes
       about half the screen, and half the screen is a fraction of the HEIGHT
       at every size. Six lines at 0.88 leading and 7.6vh is 40% of the frame
       on a 390px phone, an 820px tablet and a 980px layout viewport alike.
       The width term is a guard rather than the driver: it binds only on
       frames narrow enough that the longest single word would not fit.
       max-width:6em is what guarantees the six lines. Wrapping is what makes
       the headline big, but a size chosen for the height will not necessarily
       wrap every line, and a stack with two lines wrapped and one not reads
       as a mistake. The longest line is 8.33em and the shortest 6.08em, so a
       5.85em column wraps all three with margin, and the longest single word
       is 5.30em, so it still holds. At a bare 6em the shortest line cleared
       it by 1.3% and stopped wrapping above 600px, giving five lines. */
    /* Taken down twice on request. 7.6vh as delivered, then 6.7, now 5.8, with
       the width divisor moving with it each time: 5.52, 6.27, 7.24. That is
       about 24% off the delivered size, and 47px on a 375px phone.
       BOTH terms move, by the same factor, every time. They are a min()
       against each other, so changing only the height term would leave the
       width guard binding at its old size on a narrow frame and the headline
       would go back to full size on exactly the phones it was loudest on.
       Everything downstream is in em - the 5.85em column that guarantees six
       wrapped lines, the letter-spacing - so it all comes with it and the
       wrap is unchanged. */
    .hero-copy h1{font-size:min(calc((100vw - 2 * var(--hpad)) / 7.24),5.8vh);
                  max-width:5.85em;letter-spacing:-.045em}
    .hero-copy h1 .ln{white-space:normal;width:auto;max-width:none}
    .hero-copy h2,.hero-copy--right h2{
      font-size:min(calc((100vw - 2 * var(--hpad)) / 7.05),8.2vh)}
    /* The wide layout pushes each closing line to the right of a right-set
       column with margin-left:auto, because a box sized to its own text
       cannot be moved by text-align. Here the column is full width and set
       left, so that rule stranded the closing heading against the right edge
       with its paragraph and button still on the left. */
    .hero-copy--right h2 .ln{margin-left:0}
    .hero-copy h1{line-height:.88;margin-bottom:.75rem}
    .hero-copy h2{line-height:.94;margin-bottom:.7rem}
    /* The paragraph comes BACK. It was cut to buy the model room, which was
       treating a layout problem as a content problem: the model now takes its
       size from what the copy leaves, so the copy no longer has to be starved
       to make space. Only the second sentence goes, because on a phone the
       first one is the promise and the rest is detail. */
    /* The paragraph goes on EVERY portrait frame, not just narrow ones, so
       the arrangement is the same shape at every size. Title, buttons, ticks,
       then the model: adding a paragraph does not leave a bottom half for the
       model to be in. It stays on the wide layout, where there is room for it
       to be the line that explains the headline. */
    .hero-copy p{display:none}
    .p-tail{display:none}
    .btn-row{gap:.5rem}
    /* em padding and vh type, so the controls hold their proportion against
       a headline that is itself a fraction of the frame height. */
    /* 1em of side padding, not 1.5. On a 360px frame the two buttons
       measured 336px against a 328px column and dropped to two rows, which
       costs 5% of the screen and makes the block a different shape there than
       everywhere else. Touch frames also show the arrow permanently, because
       a hover state never resolves on them, so the row is wider on a phone
       than it is in a desktop browser pretending to be one. */
    .btn{padding:.78em 1em;font-size:clamp(.88rem,1.85vh,1.6rem)}
    .ticks{gap:1rem;font-size:clamp(.85rem,1.6vh,1.4rem);margin-top:.8rem;
           line-height:1.3}
    .ticks svg{width:1.15em;height:1.15em}
    /* Sized to its content again, and no longer padded out to the tallest
       block's height. It was stretched so that a short beat would end where a
       tall block ends and the model could sit under either; the camera now
       reserves each block's OWN height instead, so the beat keeps its two
       lines and the model comes up to meet it. */
    /* The same header allowance as .hero-copy above. These two are frames of
       one animation laid over each other, so an offset on one and not the
       other would make the piece jump vertically as it cuts between them. */
    .hero-beats{position:absolute;top:0;left:0;right:0;width:auto;
                transform:none;padding:calc(1.05rem + var(--ct-header,0px)) var(--hpad) 0}
    .hero-beat{font-size:min(calc((100vw - 2 * var(--hpad)) / 7.15),9vh);
               line-height:.92}
    /* The JS drives copy opacity from scroll; the transform is set here so a
       block never lands under the phone on a narrow frame. */
    .ct-js .hero-copy{will-change:opacity}
  }


  /* Touch: hover states never resolve, so a hovered button would stay lit
     after a tap. Bind the same treatment to :active instead. */
  @media (hover:none){
    .btn__go{max-width:1.4em;opacity:.75;transform:none}
    .btn--primary:active{background-position:100% 0}
    .btn--ghost:active::before{opacity:1;transform:scale(1)}
  }

  @media (max-width: 720px){
    .scrub{left:.6rem;right:.6rem;bottom:.6rem;flex-wrap:wrap;gap:.5rem;
           font-size:.72rem;padding:.45rem .7rem}
    .scrub input{width:100%;order:9}
    .inspect__head{padding:2.25rem 1.1rem 1rem}
    .inspect__stage{padding:0 1.1rem;height:min(62vh,520px)}
  }

  @media (prefers-reduced-motion: reduce){
    /* The tick loop stops and everything stays in its resting state, which is
       drawn, legible and complete. */
    .ticks span,.ticks .ring,.ticks .mark{animation:none}
    .ticks .ring{opacity:0}
    /* The idle animation stops; the mark and the rule stay drawn, because
       their resting state is the visible one. */
    .hero-scroll{height:100vh}
    /* ZERO THE SHIFT, NOT THE TRANSFORM, AND LEAVE OPACITY ALONE. This rule
       used to read 'opacity:1!important;transform:none!important' and it was
       two bugs.
       transform:none also drops the -50% centring, because the wide layout
       composes the shift and the centring into ONE declaration, so the copy
       column fell half its own height down the frame for every visitor who
       asks for less motion.
       And forcing opacity to 1 dates from when both copy blocks defaulted to
       visible. They are the first and last frames of one animation now, and on
       a portrait frame both are pinned to the top of the stage, so it stacked
       the closing heading straight onto the opening one: the same defect the
       loading-state check was written to catch, in the one state that check
       does not cover.
       Reduced motion removes the damping and the scroll travel, not the piece,
       and the script still drives which frame is showing. */
    .ct-js .hero-copy,.ct-js .hero-beat{--shift:0px!important}
  }

  /* ---------- short landscape, which is the second thing the fixed header
     breaks ----------
     In landscape the copy is centred on the stage and then LIFTED 3.2rem above
     centre, which is part of the composition rather than an accident. On a tall
     window that lift is free. On a 1280x620 laptop it carried the block up
     behind Cardtly's header by 60px, hiding the first line of the headline -
     the same defect as portrait, arriving by a different route.

     Held to short windows on purpose. Above this height the piece is exactly as
     delivered, because moving a deliberate composition down by half a header on
     every screen to fix the screens where it does not fit would be paying for a
     narrow problem out of the whole design.

     Below the query the block is centred on the space UNDER the header instead
     of on the whole stage, which is the same relationship to what the viewer can
     actually see, and the lift goes entirely. Keeping even 1rem of it left the
     CLOSING block behind the header by 4px: that one is 514px tall against the
     opening block's 475, so the two do not clear by the same margin and the
     taller one is what the allowance has to be measured against. */
  @media (min-aspect-ratio:1/1) and (max-height:860px){
    .hero-copy{top:calc(50% + var(--ct-header) / 2);
               transform:translateY(calc(-50% + var(--shift,0px)))}
    .hero-beats{top:calc(50% + var(--ct-header) / 2)}
  }`

// No script means no animation, so the two copy blocks stop being frames of
// one thing and become two readable sections.
const NOSCRIPT_CSS = `/* No script means no animation, so the two blocks stop being frames of one
     and become two sections. Taken out of the overlay and stacked, both are
     readable and neither is on top of the other. */
  .hero-copy{position:static;opacity:1;transform:none;width:auto;
             max-width:52ch;margin:0 auto;padding:2rem 1.25rem;text-align:left}
  .hero-copy--right{text-align:left}
  .hero-copy--right p,.hero-copy--right .btn-row,.hero-copy--right .ticks{
    margin-left:0;justify-content:flex-start}
  .hero-scroll{height:auto}
  .hero-stage{position:static;height:auto;display:block;padding:2rem 0}
  .hero-beats{display:none}`

// The mark that draws itself, once per tick line.
function Tick({ children }: { children: React.ReactNode }) {
  return (
    <span>
      <svg viewBox="0 0 17 17" aria-hidden="true">
        <circle className="ring" cx="8.5" cy="8.5" r="7" />
        <path className="mark" d="M3.6 8.9 L7 12.2 L13.4 4.9" />
      </svg>
      {children}
    </span>
  )
}

function Btn({ href, label, primary }: { href: string; label: string; primary?: boolean }) {
  return (
    <Link className={`btn ${primary ? 'btn--primary' : 'btn--ghost'}`} href={href}>
      <span className="btn__lume" aria-hidden="true" />
      <span className="btn__label">{label}</span>
      <span className="btn__go" aria-hidden="true">&rarr;</span>
    </Link>
  )
}

export default function HeroScene() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <noscript><style dangerouslySetInnerHTML={{ __html: NOSCRIPT_CSS }} /></noscript>

      <section className="hero-scroll" id="hero-scroll">
        <div className="hero-stage" id="hero-stage">
          <canvas id="hero-gl" aria-hidden="true" />

          {/* The first frame, held up while the scene builds: a PMREM bake, the
              phone geometry and five textures take a moment, and an empty black
              stage for that moment reads as a broken page.

              Three files rather than three data URIs. The staging is restaged
              by aspect rather than scaled, so a landscape render cropped onto a
              phone is a picture of a different composition; as separate sources
              the browser downloads only the one its viewport matches instead of
              parsing all three out of the document. The media queries are the
              SAME ones that switch the layout, so the poster and the live scene
              always agree about which arrangement is in force. */}
          <picture>
            <source media="(max-aspect-ratio: 3/5)" srcSet="/hero/poster-portrait.webp" />
            <source media="(max-aspect-ratio: 1/1)" srcSet="/hero/poster-tall.webp" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img id="hero-poster" className="hero-poster" alt=""
              src="/hero/poster-wide.webp" fetchPriority="high" />
          </picture>

          <div className="hero-copy hero-copy--left">
            <h1>
              <span className="ln">More leads.</span>
              <span className="ln">More meetings.</span>
              <span className="ln grad">More sales.</span>
            </h1>
            <p>
              One branded digital business card for everyone on your team.
              <span className="p-tail"> They tap, the lead lands in your contacts, and you
              can see which reps are getting opened.</span>
            </p>
            <div className="btn-row">
              <Btn href="/signup" label="Sign up" primary />
              <Btn href="#teams" label="Cardtly for teams" />
            </div>
            <div className="ticks">
              <Tick>Free trial on request</Tick>
              <Tick>Live in 2 minutes</Tick>
            </div>
          </div>

          <div className="hero-beats" aria-hidden="true">
            <p className="hero-beat">
              <span className="ln">One tap.</span>
              <span className="ln grad">Card shared.</span>
            </p>
          </div>

          <div className="hero-copy hero-copy--right">
            <h2>
              <span className="ln">Tapped.</span>
              <span className="ln">Saved.</span>
              <span className="ln grad">Followed up.</span>
            </h2>
            <p>
              Your details land straight in their phone.
              <span className="p-tail"> Update your profile once and every card you have
              ever handed out is current again, instantly.</span>
            </p>
            <div className="btn-row">
              <Btn href="/signup" label="Claim your card" primary />
            </div>
            <div className="ticks">
              <Tick>Tap, QR or link</Tick>
              <Tick>Made in South Africa</Tick>
            </div>
          </div>
        </div>
      </section>

      <HeroSceneLoader />
    </>
  )
}
