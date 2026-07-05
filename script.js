document.addEventListener("DOMContentLoaded", function () {

    const images = [
        "images/Artichoke.jpg",
        "images/Baby Bok Choy.jpg",
        "images/Carrot Bed.jpg"
        "images/Herbs.jpg",
    ];

    let currentImage = 0;

    const aboutImage = document.getElementById("aboutImage");

    if (aboutImage) {

        setInterval(function () {

            currentImage++;

            if (currentImage >= images.length) {
                currentImage = 0;
            }

            aboutImage.src = images[currentImage];

        }, 3000);

    }

});
