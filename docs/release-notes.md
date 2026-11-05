# Newbie Launcher 0.1.20

Essential mods stay protected during repair.

## Repair

- Repair no longer chooses essential mods as the mod to disable when resolving a conflict.
- Protected out of the box: Fabric API, Fabric Language Kotlin, Quilt API/QSL, Sodium, Embeddium, Rubidium, Iris, Oculus, Indium, Lithium, FerriteCore, Krypton, ModernFix, ImmediatelyFast, EntityCulling, C2ME, Noisium, ThreadTweak, BadOptimizations, MemoryLeakFix, Debugify, Cloth Config, Architectury, Forge Config API Port, YACL and Mod Menu.
- If another mod conflicts with a protected mod, the other mod is offered for disabling instead.
- If two protected mods conflict, Newbie disables neither and reports a manual conflict.
- A mod required by another active mod is also protected from conflict disables, even if it is not in the curated list.
- Missing-dependency fallbacks never disable essential or required mods. They are left enabled and the problem is reported for manual review.

## Notes

- Protection applies to conflict resolution and dependency fallbacks.
- Unreadable, wrong-loader or duplicate copies can still be disabled after confirmation because they cannot stay active as-is. Duplicate cleanup always keeps one working copy.
- The Repair window now states that essential mods are protected.

Everything from 0.1.19 (datapacks), 0.1.18 (TLSkinCape) and earlier is included.
