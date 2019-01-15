const request = require('request');
const fs = require('fs');

function fetch(fileKey, token) {
    const getImages = async icons => {
        const perChunk = 24;
        const iconMap = {};
        const frameChunks = icons.reduce((chunks, icon, i) => {
            const chunkIndex = Math.floor(i / perChunk);

            chunks[chunkIndex] = chunks[chunkIndex] || [];
            chunks[chunkIndex].push(icon.id);

            iconMap[icon.id] = {
                id: icon.id,
                name: icon.name,
            };

            return chunks;
        }, []);

        const chunkPromises = frameChunks.map(frameChunk => {
            return fetchUrl(`images/${fileKey}?ids=${frameChunk.join(',')}&format=svg`);
        });

        const res = await Promise.all(chunkPromises);
        let images = {};

        res.filter(e => e.images).forEach(e => {
            images = { ...images, ...e.images };
        });

        parseSVG(images, iconMap);
    };

    const parseSVG = (images, iconMap) => {
        Object.entries(iconMap).forEach(([key, icon]) => parseIcon(images[key], icon.name));
    };

    const parseIcon = (url, name) => {
        request.get(url).pipe(fs.createWriteStream(`icons/${name}.svg`));
    };

    const fetchUrl = url => {
        const options = {
            url: `https://api.figma.com/v1/${url}`,
            headers: {
                'Content-Type': 'application/json',
                'X-Figma-Token': token,
            },
        };

        return new Promise((resolve, reject) => {
            request(options, (error, response, body) => {
                console.log(error, response.statusCode);
                switch (response.statusCode) {
                    case 200:
                        return resolve(JSON.parse(body));
                    case 400:
                    case 403:
                        return reject({
                            code: response.statusCode,
                            message: "Error fetching icons from Figma. Maybe you're unauthorized?",
                        });
                    default:
                        return reject({ code: response.statusCode, message: 'Something went wrong with the request.' });
                }
            });
        });
    };

    try {
        fetchUrl(`files/${fileKey}`)
            .then(data => {
                getImages(data.document.children[0].children);
            })
            .catch(error => {
                console.log(error.code, error.message);
            });
    } catch (e) {
        console.log('Something went wrong with the request', e, e.message);
    }
}

module.exports = fetch;
