# Performance

PERF wave5 80 enemies: 59 FPS · 16.8 ms/frame · entities 81

Top costs before fix: Zustand HUD writes every frame, particle emitters, unpooled bullets, full-tree React HUD, name-tag loops.
Fixes: 10Hz dirty HUD, menu pause, bullet pool cap 80, quality presets, F3 meter, dpr cap 2.
