var basic = require('./basic.js'),
    timeStamp = ''+Math.round(+new Date()/1000),
    assert = require('assert');


function findUp(driver, element, number) {
    return driver.findElements({css:'' + element + ''}).then(function (result) {
        return result[number];
    }).thenCatch(function (e) {basic.errorHandler(e, "Cannot find " + element);});
}

function clickUp(element) {
    element.click()
        .thenCatch(function (e) {basic.errorHandler(e,"Cannot click");});
}

function welcome(driver) {
    basic.execute(driver, 'click', 'a[href="#/v-l:Welcome"]', "Cannot click on 'Welcome' button", '');
}

/**
 * Открытие сообщений
 * @param driver
*/
function open(driver) {
    basic.menu(driver, 'Inbox');
    driver.sleep(1000);
}

/**
 * Ответ на сообщение, выбор решения, комментирование и выбор Персоны
 * @param driver -
 * @param number - номер решения
 * @param commentValue - статус комментирования
 * @param chooseValue - статус выбора Персоны
*/
function openMsg(driver, number, commentValue, chooseValue) {
    open(driver);
    driver.wait(findUp(driver, 'a[property="rdfs:label"]', 3), basic.FAST_OPERATION).then(clickUp);
    basic.execute(driver, 'click', 'div[class="radio decision"] input[value="' + number + '"]', "Cannot click on '" + number + "' decision", '');
    if (commentValue === '+') {
        basic.execute(driver, 'sendKeys', 'veda-control[property="rdfs:comment"] div textarea', "Cannot fill 'comment'", timeStamp);
    }
    if (chooseValue === '+') {
        driver.executeScript("document.querySelector('#fulltext').scrollIntoView(true)");
        basic.chooseFromDropdown(driver, 'v-wf:to', 'Администратор4', 'Администратор4 : Аналитик');
    }
    driver.sleep(basic.FAST_OPERATION);
    driver.executeScript("document.querySelector('#send').scrollIntoView(true)");
    basic.execute(driver, 'click', 'button[id="send"]', "Cannot click on 'Ok' button", '');
    welcome(driver);
}

/**
 * Проверка сообщений
 * @param driver
 * @param count - количество сообщений, которое должно быть;
*/
function checkMsg(driver, count) {
    open(driver);
    driver.findElements({css:'span[property="v-s:description"]'}).then(function (result) {
        assert.equal(count, result.length);
    }).thenCatch(function (e) {basic.errorHandler(e, "Invalid `message` elements count");});
    welcome(driver);
}

module.exports = {
    /**
     * Проверка сообщений
     * @param driver 
     * @param count - количество сообщений
     * @param login       |
     * @param password    | Данные для входа
     * @param firstName   |
     * @param lastName    |
    */
    checkTask: function (driver, count, login, password, firstName, lastName) {
        basic.login(driver, login, password, firstName, lastName);
        checkMsg(driver, count);
        basic.logout(driver);
    },

    /**
     * Ответ на сообщение
     * @param driver 
     * @param decision - номер решения
     * @param commentValue - статус комментирования
     * @param chooseValue - статут выбора Персоны
     * @param login       |
     * @param password    | Данные для входа
     * @param firstName   |
     * @param lastName    |
    */
    acceptTask: function (driver, decision, commentValue, chooseValue, login, password, firstName, lastName) {
        basic.login(driver, login, password, firstName, lastName);
        openMsg(driver, decision, commentValue, chooseValue);
        basic.logout(driver);
    },
    /**
     * Проверка статуса маршрута
     * @param driver
     * @param element - список элементов
     * @param color - список цветов элементов
     * @param count - количество элементов в данном состоянии
     * @param docNumber - номер документа в поиске
    */

    checkRouteStatus: function (driver, element, color, count, docNumber) {
        basic.login(driver, 'karpovrt', '123', '2', 'Администратор2');
        basic.openFulltextSearchDocumentForm(driver, 'Стартовая форма сети Комплексный маршрут', 's-wf:ComplexRouteStartForm');
        basic.execute(driver, 'click', 'button[id="submit"]', "Cannot click on 'Submit/Отправить' button", '');
        driver.sleep(basic.SLOW_OPERATION);
        driver.wait(findUp(driver, 'span[rel="v-wf:isProcess"]', docNumber), basic.FAST_OPERATION).then(clickUp);
        driver.sleep(basic.FAST_OPERATION);
        basic.execute(driver, 'click', '.glyphicon-share-alt', "Cannot click on 'glyphicon-share-alt'", '');
        for (var i = 0; i < element.length; i++) {
            driver.findElements({css:'div[id="'+ element[i] +'"][colored-to="'+ color[i] +'"]'}).then(function (result) {
                assert.equal(count, result.length);
            }).thenCatch(function (e) {basic.errorHandler(e, "Seems route status is wrong");});
        }
        welcome(driver);
        basic.logout(driver);
    }

}



