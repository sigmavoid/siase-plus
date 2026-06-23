function makeSVGFacebook({
    svgId = "facebook-icon",
    fill = "currentColor",
    width = 24,
    height = 24
}) {
    return `<svg
        id="${svgId}"
        viewBox="0 0 95.333 95.333"
        width="${width}"
        height="${height}"
        fill="${fill}">
        <path d="M93.333,0H2C0.896,0,0,0.896,0,2v91.332c0,1.104,0.896,2,2,2h48.525V63.477H40.284..." />
    </svg>`;
}

function makeSVGTwitter({
    svgId = "twitter-icon",
    width = 24,
    height = 24
}) {
    return `<svg
        id="${svgId}"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 512 462.799"
        width="${width}"
        height="${height}"
        shape-rendering="geometricPrecision"
        text-rendering="geometricPrecision"
        image-rendering="optimizeQuality">
        <path
            fill="currentColor"
            fill-rule="nonzero"
            d="M403.229 0h78.506L310.219 196.04 512 462.799H354.002L230.261 301.007 88.669 462.799h-78.56l183.455-209.683L0 0h161.999l111.856 147.88L403.229 0zm-27.556 415.805h43.505L138.363 44.527h-46.68l283.99 371.278z"/>
    </svg>`;
}
