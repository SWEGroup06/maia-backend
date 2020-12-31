/**
 */
console.log('---sign up form---');
const params = new URLSearchParams(window.location.search);
const email = params.get('email');
const token = params.get('token');
console.log('---email---', email);

$(window).scroll(function() {
  const theta = $(window).scrollTop() / 100 % Math.PI;
  $('#spinner').css({transform: 'rotate(' + theta + 'rad)'});
});

// eslint-disable-next-line require-jsdoc
function spin(x) {
  const theta = (x+1)*10 % Math.PI;
  $('#spinner').css({transform: 'rotate(' + theta + 'rad)'});
}

// wait for the DOM to be loaded
$(function() {
  // bind 'myForm' and provide a simple callback function
  $('#signUpForm').submit(function() {
    const answers = $('form').serializeArray();
    const data = {email: email, answers: answers, token: token};
    console.log('form', data);

    fetch('../signup', {
      method: 'post',
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    }).then((res)=>res.json())
        .then((res) => console.log(res));


    //   const url = `../signup`;
    //   // ?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}&${x}`;
    //
    //   // ?email=${email}
    //   //                     &token=${token}
    //   //                     &${x}`;
    //   // fetch(url).then((data) => data.json()).then(resolve);
    //   console.log('posting to:', url);
    //   await fetch(url, {
    //     method: 'post',
    //     body: JSON.stringify({start: 'hello', end: 'bye'}),
    //   }).then(function(response) {
    //     return response.json();
    //   });

    // if (res.error !== null) {
    //   console.log(this.action);
    //   this.action = `./signupError.html?error=${res.error}`;
    //   console.log(this.action);
    // }
    // alert(res.error);
    return true;
  });
  // Position of the header in the webpage
  const position = $('h1').position();
  const padding = 10; // Padding set to the header
  const left = position.left + padding;
  const top = position.top + padding;
  $('h1').find('span').css('background-position', '-'+left+'px -'+top+'px');
});

$('.scroll-down').click(function() {
  console.log('scroll');
  $('html, body').animate({scrollTop: $('section#questionsContainer').offset().top}, 'slow');
  // setFocusToInput1();
  return false;
});

// eslint-disable-next-line require-jsdoc
function init() {
  const ul = document.querySelector('ul.items');
  // Generate li foreach fieldset
  for (let i = 0; i < count; i++) {
    const li = document.createElement('li');

    ul.appendChild(li);
  }
  // Add class active on first li
  ul.firstChild.classList.add('active');
}

let idx = 1;

// eslint-disable-next-line require-jsdoc
function next(target) {
  const input = target.previousElementSibling;

  // Check if input is empty
  if (input.value === '') {
    body.classList.add('error');
  } else {
    idx++;
    spin(idx);
    body.classList.remove('error');

    const enable = document.querySelector('form fieldset.enable');
    const nextEnable = enable.nextElementSibling;
    enable.classList.remove('enable');
    enable.classList.add('disable');
    nextEnable.classList.add('enable');

    // Switch active class on left list
    const active = document.querySelector('ul.items li.active');
    const nextActive = active.nextElementSibling;
    active.classList.remove('active');
    nextActive.classList.add('active');
  }
}
// eslint-disable-next-line require-jsdoc
function back(target) {
  // Check if input is empty
  idx--;
  spin(idx);
  body.classList.remove('error');

  const enable = document.querySelector('form fieldset.enable');
  const nextEnable = enable.previousElementSibling;
  enable.classList.remove('enable');
  nextEnable.classList.remove('disable');
  nextEnable.classList.add('enable');

  // Switch active class on left list
  const active = document.querySelector('ul.items li.active');
  const nextActive = active.previousElementSibling;
  active.classList.remove('active');
  nextActive.classList.add('active');
}

// eslint-disable-next-line require-jsdoc
function keyDown(event) {
  const key = event.keyCode;
  const target = document.querySelector('fieldset.enable .button');
  if (key == 13 || key == 9) next(target);
}

// eslint-disable-next-line no-var
var body = document.querySelector('body');
const form = document.querySelector('form');
// eslint-disable-next-line no-var
var count = form.querySelectorAll('fieldset').length;

window.onload = init;
document.body.onmouseup = function(event) {
  const target = event.target || event.toElement;
  if (target.classList.contains('next')) {
    console.log('target', target, ' id', target.id);
    next(target);
  }
  if (target.classList.contains('back')) {
    console.log('target', target, ' id', target.id);
    back(target);
  }
};
document.addEventListener('keydown', keyDown, false);
