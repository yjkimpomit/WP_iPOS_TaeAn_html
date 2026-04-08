(function () {

    // 더미 데이터를 기반으로 랜덤화된 데이터를 생성하는 함수
    function generateRandomizedDataFromTemplate(templateData) {
        const result = {};
        const now = new Date();

        for (const key in templateData) {
            const lowerKey = key.toLowerCase();

            // console.log("lowerKey:", lowerKey);

            if (lowerKey.includes("time")) {
                // 시간 형식
                result[key] = now.toLocaleTimeString();

            } else if (lowerKey.includes("rectangle")) {
                // Rectangle 계열 → 0, 1, 2 중 하나
                result[key] = Math.floor(Math.random() * 3).toString(); // "0", "1", "2"
            }
            else if (lowerKey.includes("ellipse")) {
                // Rectangle 계열 → 0, 1, 2 중 하나
                result[key] = Math.floor(Math.random() * 3).toString(); // "0", "1", "2"
            }
            else if (lowerKey.includes("polygon")) {
                // Rectangle 계열 → 0, 1, 2 중 하나
                result[key] = Math.floor(Math.random() * 3).toString(); // "0", "1", "2"
            }
            else if (lowerKey.includes("greenvessel")) {
                // Rectangle 계열 → 0, 1, 2 중 하나
                result[key] = Math.floor(Math.random() * 3).toString(); // "0", "1", "2"
            }
            else if (lowerKey.includes("nocrescentarrow")) {
                // Rectangle 계열 → 0, 1, 2 중 하나
                result[key] = Math.floor(Math.random() * 3).toString(); // "0", "1", "2"

            } else if (lowerKey.includes("line")) {
                // Rectangle 계열 → 0, 1, 2 중 하나
                result[key] = Math.floor(Math.random() * 3).toString(); // "0", "1", "2"

            } else if (lowerKey.includes("viewbox")) {
                // Rectangle 계열 → 0, 1, 2 중 하나
                const val = Math.random() * 3;           // [0, 2)
                result[key] = val.toFixed(1);

            } else if (lowerKey.includes("text33_pbtextel")) {
                // Rectangle 계열 → 0, 1, 2 중 하나
                result[key] = Math.floor(Math.random() * 2).toString(); // "0", "1", "2"

            } else if (lowerKey.includes("reducer")) {
                result[key] = Math.floor(Math.random() * 3).toString(); // "0", "1", "2"

            } else if (lowerKey.includes("bar6_pbbarboundingrectel")) {
                // Bar 계열 → 예: 0~1000 사이 실수값
                const maxBarValue = 1000;
                const randBarVal = (Math.random() * maxBarValue).toFixed(1);
                result[key] = randBarVal;

            } else if (lowerKey.includes("bar5_pbbarboundingrectel")) {
                // Bar 계열 → 예: 0~1000 사이 실수값
                const maxBarValue = 25;
                const randBarVal = (Math.random() * maxBarValue).toFixed(1);
                result[key] = randBarVal;

            }
            else if (lowerKey.includes("bar4_pbbarboundingrectel")) {
                const min = -500;
                const max = 500;
                const randBarVal = (min + Math.random() * (max - min)).toFixed(1); // "-123.4" 같은 문자열
                result[key] = randBarVal;
            }
            else if (lowerKey.includes("bar3_pbbarboundingrectel")) {
                const min = -500;
                const max = 500;
                const randBarVal = (min + Math.random() * (max - min)).toFixed(1); // "-123.4" 같은 문자열
                result[key] = randBarVal;
            }
            else if (lowerKey.includes("bar2_pbbarboundingrectel")) {
                const min = -250;
                const max = 150;
                const randBarVal = (min + Math.random() * (max - min)).toFixed(1); // "-123.4" 같은 문자열
                result[key] = randBarVal;
            }
            else if (lowerKey.includes("bar1_pbbarboundingrectel")) {
                // Bar 계열 → 예: 0~1000 사이 실수값
                const maxBarValue = 100;
                const randBarVal = (Math.random() * maxBarValue).toFixed(1);
                result[key] = randBarVal;
            }
            else if (lowerKey.includes("pvtextblock7") || lowerKey.includes("pvtextblock81") || lowerKey.includes("pvtextblock9") || lowerKey.includes("pvtextblock10") || lowerKey.includes("pvtextblock11")) {
                const min = -0.5;
                const max = 2;
                const randBarVal = (min + Math.random() * (max - min)).toFixed(1); // "-123.4" 같은 문자열
                result[key] = randBarVal;

            }
            else {
                // 기타 → 기본 랜덤 숫자
                result[key] = (Math.random() * 100).toFixed(1);
            }
        }

        return result;
    }


    async function fetchDataFromDummy(utagToElementMap) {

        const tagList = Object.keys(utagToElementMap); // std_tag 목록

        if (tagList.length === 0) {
            console.warn("태그 목록이 비어 있습니다.");
            return {};
        }
        // console.log("서버에 요청할 태그 목록:", tagList);

        return await getDummyData("db.json");
    }

    async function getDummyData(filePath) {
        try {
            const response = await fetch(filePath);
            const templateData = await response.json();

            return generateRandomizedDataFromTemplate(templateData); // 값만 랜덤화
        } catch (e) {
            console.error("더미 데이터 로딩 실패", e);
            return {};
        }
    }

    window.generateRandomizedDataFromTemplate = generateRandomizedDataFromTemplate;
    window.fetchDataFromDummy = fetchDataFromDummy;
    window.getDummyData = getDummyData;

})();