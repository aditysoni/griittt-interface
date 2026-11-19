# Human body models

Male, female and neutral adult bodies use MakeHuman's CC0 base geometry and adult morph targets, prepared locally for GRITTT. These are generic display mannequins, not scans or estimates of a user's actual body. Clothing is a matte-material surface region. Named mesh regions support training highlights; the anatomical region boundaries are visual approximations of the app's seven primary-muscle categories.

Source: https://github.com/makehumancommunity/makehuman
Base: makehuman/data/3dobjs/base.obj
Adult morphs: makehuman/data/targets/macrodetails/{african,asian,caucasian}-{male,female}-young.target and universal-{male,female}-young-{averagemuscle,maxmuscle}-averageweight.target.
Only the body surface is exported; joint/helper geometry is omitted. Each asset is centered, approximately two units tall, with smoothed normals and separately named renderable regions. No user identifiers or activity data are embedded.

License: source assets are CC0. See LICENSE-MAKEHUMAN.md and https://www.makehumancommunity.org/about/license.html. MakeHuman's software license is separate from its asset license. We are distributing generated graphical assets, not the MakeHuman application.

Reproduce GLBs with `python3 scripts/build-body-models.py /path/to/source-folder`. Source files use the basenames listed above. This preparation is offline and is not part of app runtime. To regenerate lightweight static previews, provide @resvg/resvg-js in the tooling environment (or its resolved module path via RESVG_MODULE), then run `node scripts/render-body-previews.cjs`.

Filament loads the bundled GLBs. The Food diagram and old-native-build fallback use PNG previews rendered from the same geometry. Neutral is a blend of the male/female adult targets; display preference is selected by the user, not inferred from their name.
