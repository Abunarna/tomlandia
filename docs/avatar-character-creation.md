# Character creation UX plan

The development route `/character-test` is a responsive prototype built on the real layered renderer. It deliberately starts the player in basic clothing with no armour or sword, so identity comes from model, face, hairstyle, skin tone, hair colour, and name.

## Flow

1. Choose male or female body model.
2. Choose one of four compatible faces.
3. Choose one of ten grayscale hairstyles.
4. Choose skin and runtime hair colours.
5. Enter a short character name.
6. Save a versioned local draft; valid drafts are restored on the next visit. Account persistence and the final “enter world” action remain outside this prototype until the avatar schema is connected to save/load.

The live preview stays visible on desktop, while the single-column mobile layout places it before the controls. The small preview uses the same `PlayerAvatarRenderer` and nearest-neighbour rendering contract as the Avatar Lab. Clear pressed states, large touch targets, text labels in addition to colour, and a disabled unnamed save action make the screen usable without relying on hover or colour alone.

The test build exposes this route through the in-game **Character test** button,
which replaces the former Knight debug control. It remains a review surface—not
the live onboarding flow. Reference geometry remains visibly labelled as a
prototype and must be replaced by approved bald-body, face, and hairstyle
candidates before this screen is connected to onboarding.

The character test uses all eight registered candidate faces and all ten fitted,
grayscale candidate hairstyles. Those review layers remain paired with the
stable reference bodies until the replacement male and female body masters pass
their silhouette and registration gates.

Below the interactive composite, a source-layer gallery renders those exact
checked-in candidate PNG URLs as ordinary pixelated images. This makes it
immediately obvious if a deployed review page has substituted vector drawings,
generic portraits, or labels that do not come from the candidate manifest.

Draft loading is deliberately defensive: malformed JSON, obsolete versions,
invalid colours, overlong names, missing visual IDs, and face/hair choices that
do not support the selected model are discarded rather than reaching the
renderer. The browser draft is a convenience preview, not authoritative player
save data.
