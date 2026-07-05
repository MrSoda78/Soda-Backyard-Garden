document.addEventListener("DOMContentLoaded", function () {

    const images = [
        "images/Lettuce #2.jpg",
        "images/Cabbage Row.jpg",
        "images/Container Garden #2.jpg",
        "images/Herbs.jpg",
        "images/Vertical Planter.jpg"
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
