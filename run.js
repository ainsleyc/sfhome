const cheerio = require('cheerio');
const fs = require('fs');
const request = require('request');

const minPrice = 0;
const maxPrice = 1300000;

const minBeds = 2;

const latLongToken = `globalrelevanceex_sort/37.900323,-121.363907,36.835119,-122.840195_rect`;

const REQUEST_BASE_INTERVAL = 60000;
const REQUEST_STAGGER_INTERVAL = 20000;

const AVE_SCHOOL_RATING_MINIMUM = 7;

const metadataByCity = new Map([
  [ 'sunnyvale', new Map([
    [ 'zipcodeSearchPrefix', 'Sunnyvale-CA-' ],
    [ 'zipcodes', new Map([
      [ 94085, new Map([[ 'note', 'Adjacent to 101' ]])],
      [ 94086, new Map([[ 'note', 'Along Evelyn' ]])],
      [ 94087, new Map([[ 'note', 'South Sunnyvale' ]])],
    ])],
  ])],
  [ 'mountainview', new Map([
    [ 'zipcodeSearchPrefix', 'Mountain-View-CA-' ],
    [ 'zipcodes', new Map([
      [ 94043, new Map([[ 'note', 'Around 101' ]])],
      [ 94041, new Map([[ 'note', 'North of El Camino' ]])],
      [ 94040, new Map([[ 'note', 'South of El Camino' ]])],
    ])],
  ])],
  [ 'westsanjose', new Map([
    [ 'zipcodeSearchPrefix', 'San-Jose-CA-' ],
    [ 'zipcodes', new Map([
      [ 95129, new Map([[ 'note', 'West of Saratoga' ]])],
      [ 95117, new Map([[ 'note', 'East of Saratoga' ]])],
      [ 95130, new Map([[ 'note', 'South of Saratoga' ]])],
      [ 95128, new Map([[ 'note', 'Fruitdale' ]])],
    ])],
  ])],
  [ 'cupertino', new Map([
    [ 'zipcodeSearchPrefix', 'Cupertino-CA-' ],
    [ 'zipcodes', new Map([
      [ 95014, new Map([[ 'note', 'Cupertino' ]])],
    ])],
  ])],
  [ 'santaclara', new Map([
    [ 'zipcodeSearchPrefix', 'Santa-Clara-CA-' ],
    [ 'zipcodes', new Map([
      [ 95051, new Map([[ 'note', 'West Santa Clara' ]])],
      [ 95050, new Map([[ 'note', 'East Santa Clara' ]])],
      [ 95054, new Map([[ 'note', 'North Santa Clara' ]])],
    ])],
  ])],
  [ 'campbell', new Map([
    [ 'zipcodeSearchPrefix', 'Campbell-CA-' ],
    [ 'zipcodes', new Map([
      [ 95008, new Map([[ 'note', 'Campbell' ]])],
    ])],
  ])],
]);

function parseCardArticle($article) {
  const zpid = extractZpidFromCardHref(
      $article.find('.zsg-photo-card-overlay-link').attr('href'));
  const infoTokens = $article.find('.zsg-photo-card-info').text().split('·')
      .map((token) => { return token.trim(); });
  return {
    zpid: zpid,
    price : $article.find('.zsg-photo-card-price').text(),
    address: $article.find('.zsg-photo-card-address').text(),
    beds: infoTokens[0],
    baths: infoTokens[1],
    sqft: infoTokens[2],
    link: createDetailsUrl({ zpid: zpid }),
  }
}

function printCardArticleResult(result) {
  console.log(`${result.price}\t${result.link}`);
}

function parseDetail($detail) {
  const $bedsDetails = $detail.find('h3');
  const $summarySection = $detail.find('section').eq(0);
  const $schoolList = $detail.find('.nearby-schools-list');
  return {
    address: $detail.find('h1').text(),
    price: $detail.find('#home-value-wrapper').find('.main-row.home-summary-row').text().trim().replace(/[,+$]/g, ''),
    beds: $bedsDetails.find('span').eq(1).text().split(' ')[0],
    baths: $bedsDetails.find('span').eq(3).text().split(' ')[0],
    sqft: $bedsDetails.find('span').eq(5).text().split(' ')[0].replace(/,/g, ''),
    openHouse: $summarySection.find('ul').eq(0).find('span').toArray().map((el) => {
      return cheerio.load(el).text();
    }).join(', '),
    type: $summarySection.find('.zsg-media-bd').eq(0).find('div').text(),
    built: $summarySection.find('.zsg-media-bd').eq(1).find('div').text(),
    elementarySchoolRating: $schoolList.find('div.nearby-schools-rating').eq(0).find('span').text(),
    middleSchoolRating: $schoolList.find('div.nearby-schools-rating').eq(1).find('span').text(),
    highSchoolRating: $schoolList.find('div.nearby-schools-rating').eq(2).find('span').text(),
  }
}

function parseDetailSummarySection($section) {
}

function extractZpidFromCardHref(href) {
  return href.split('/')[3];
}

function createDetailsUrl({ zpid = '' }) {
  return `https://www.zillow.com/homes/for_sale/${zpid}/${latLongToken}`;
}

function createArticleUrl({
    location = '',
    type = 'house,townhouse_type',
    minPrice = 0,
    maxPrice = 1300000,
    minBeds = 2,
    openHouse = true }) {
  return `https://www.zillow.com/homes/for_sale/${location}/${type}/` +
      `${minPrice}-${maxPrice}_price/${minBeds}-_beds/${openHouse ? '1_open': ''}` +
      `/${latLongToken}`;
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}

function checkSchoolRatingMinimum(detailResults) {
  return ((parseInt(detailResults.elementarySchoolRating)
      + parseInt(detailResults.middleSchoolRating)
      + parseInt(detailResults.highSchoolRating)) / 3) >= AVE_SCHOOL_RATING_MINIMUM;
}

function fetchAndParseDetails(detailUrlList) {
  let detailRequestCount = 0;
  detailUrlList.forEach((detailUrl) => {
    setTimeout(() => {
      request.get(detailUrl, (error, response, body) => {
        try {
          const $ = cheerio.load(body);
          const $detailContent = $('#search-detail-lightbox_content');
          const results = parseDetail($detailContent);
          if (checkSchoolRatingMinimum(results)) {
            console.log(`${results.address}\t${results.price}\t${results.openHouse}\t${detailUrl}\t--\t` +
                `${results.type}\t${results.built}\t${results.sqft}\t--\t--\t${results.beds}\t${results.baths}\t` +
                `${results.elementarySchoolRating}\t${results.middleSchoolRating}\t${results.highSchoolRating}`);
          }
        } catch(e) {
          console.log('Error:', e.stack);
        }
      });
    }, Math.max(((detailRequestCount + 1) * REQUEST_BASE_INTERVAL) +
        getRandomInt(-REQUEST_STAGGER_INTERVAL, REQUEST_STAGGER_INTERVAL), 0));
    detailRequestCount++;
  });
}

function run() {
  let articleRequestCount = 0;
  let articleResponseCount = 0;
  const detailUrlList = [];
  metadataByCity.forEach((metadata, city) => {
    metadata.get('zipcodes').forEach((zipcodeMetadata, zipcode) => {
      setTimeout(() => {
        const articleUrl = createArticleUrl(
          { location: `${metadata.get('zipcodeSearchPrefix')}${zipcode}` });
        request.get(articleUrl, (error, response, body) => {
          articleResponseCount++;
          try {
            const $ = cheerio.load(body);
            const $searchArticles = $('#search-results').find('ul').first().find('article');
            $searchArticles.each((i, article) => {
              const results = parseCardArticle($(article));
              console.log(`${city}\t${zipcode}\t${results.price}\t${results.address}\t` +
                  `${results.beds}\t${results.sqft}\t${results.link}`);
              detailUrlList.push(results.link);
            });
          } catch(e) {
            console.log('Error:', e.stack);
          }
          // TBD: replace with async
          if (articleRequestCount == articleResponseCount) {
            fetchAndParseDetails(detailUrlList);
          }
        });
      }, Math.max((articleRequestCount * REQUEST_BASE_INTERVAL) +
          getRandomInt(-REQUEST_STAGGER_INTERVAL, REQUEST_STAGGER_INTERVAL), 0));
      articleRequestCount++;
    });
  });
}

// testArticleUrlGeneration();
// testArticleParseFromFile();
// testDetailParseFromFile();
run();

function testArticleUrlGeneration() {
  metadataByCity.forEach((metadata, city) => {
    console.log(city);
    metadata.get('zipcodes').forEach((zipcodeMetadata, zipcode) => {
      console.log(
          createArticleUrl({ location: `${metadata.get('zipcodeSearchPrefix')}${zipcode}` }),
          `(${zipcodeMetadata.get('note')})`);
    });
    console.log();
  });
}

function testArticleParseFromFile() {
  try {
    const html = fs.readFileSync('articleParseTest.txt', 'utf8');
    const $ = cheerio.load(html);
    $('article').each((i, article) => {
      console.log(parseCardArticle($(article)));
    });
  } catch(e) {
    console.log('Error:', e.stack);
  }
}

function testDetailParseFromFile() {
  try {
    const html = fs.readFileSync('detailParseTest.txt', 'utf8');
    const $ = cheerio.load(html);
    // #hdp-content
    // #detail-container-column
    $('#search-detail-lightbox_content').each((i, detail) => {
      console.log(parseDetail($(detail)));
    });
  } catch(e) {
    console.log('Error:', e.stack);
  }
}
