# Learning design and evidence

Studio connects a short mission, a visual concept lab, a later independent attempt, and a full practice paper. The product aims to help children prepare well; it has not yet been evaluated for learning gains or contest placement.

## Design decisions

| Observation | Implemented response | Evidence |
| --- | --- | --- |
| A formula is easier to explore when variables change a picture immediately. | Parameter chips reveal explicit controls; SVG diagrams update with each change. | [OpenAI interactive math/science experience](https://openai.com/index/new-ways-to-learn-math-and-science-in-chatgpt/) describes this interaction pattern; it does not establish this app's effectiveness. |
| Children need manageable instructions and useful representations. | One focused question, a topic-linked visual, deliberate feedback, and optional thinking prompts. | [IES elementary mathematics intervention guide](https://ies.ed.gov/ncee/WWC/PracticeGuide/26/Published) recommends systematic instruction, mathematical language, and representations. |
| Reading a solution and retrieving it independently are different activities. | Worked derivations are hidden before prediction checks; help-assisted successes are tracked separately. | [IES learning and memory guide](https://ies.ed.gov/ncee/wwc/practiceguide/1) recommends alternating examples with independent solving and explanatory questions. |
| Remembering later matters. | Missions revisit due skills on increasing intervals. Replays cannot earn new evidence. | The same IES guide recommends spacing and retrieval. The app's specific interval schedule is a product heuristic, not a validated optimum. |
| Competition performance requires sustained independent work. | Explicit 75-minute mocks, skip/revisit, silent answers until submission, and a local result journal. | [Official Math Kangaroo test format](https://mathkangaroo.org/mks/faqs/about-the-test/). |

## What progress means

The progress display reflects this device's recorded attempts at the selected grade. It does not estimate national rank, intelligence, or percentile. A remembered skill requires several different independently solved problems and successful delayed retrieval; assisted answers remain useful evidence of participation.

Old practice counters lack help-use metadata. They are preserved but not silently reclassified as independent successes. The new record begins when Studio is used.

## AI boundary

The Rabbit model selects among short vetted prompts after an explicit request. It cannot author a scored question, change the answer key, or put arbitrary generated text on screen. This trades open-ended dialogue for predictable teaching and reliable fallbacks. Browser use remains useful without the device AI.

See [the Rabbit contract and tutoring research](tutor-research.md) for transport details, privacy boundaries, and voice limits.

## What still requires evidence

- Observe children in each age band using the r1 controls and learning vocabulary, including beginning readers.
- Measure independent success on unseen problems after practice, then repeat after a delay.
- Compare full mock results across equivalent papers and review actual competition outcomes.
- Have an experienced contest educator review the authored families for challenge level, visual reasoning depth, and curricular breadth. Automated checks validate tested properties, not every aspect of pedagogy.
- Verify current physical r1 firmware, speaker behavior, and native callback latency. Chrome viewport and mocked SDK tests cover app behavior but cannot establish those device properties.
