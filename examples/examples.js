$(function() {

  var pointyCode = CodeMirror($('#pointy')[0], { mode: 'htmlmixed' });
  var jsonCode = CodeMirror($('#json')[0], { mode: 'javascript', json: true });
  var outputCode = CodeMirror($('#output')[0], { mode: 'htmlmixed' });

  $('div[data-example]').each(function() {
    $('<li>')
        .appendTo('.dropdown-menu')
        .append($('<a>', {
          href: '#',
          text: $(this).data('example')
        }));
  });

  $('.dropdown-menu').on('click', 'a', function(e) {
      e.preventDefault();
      var $example = $('div[data-example="' + $(this).text() + '"]');
      pointyCode.setValue($.trim($example.find('script[type$="pointy"]').text()));
      jsonCode.setValue($.trim($example.find('script[type$="json"]').text()));
      outputCode.setValue('');
    });

  $('#render').click(function(e) {
    e.preventDefault();

    var template, data, fn, output;

    try {
      data = JSON.parse(jsonCode.getValue());
    } catch(err) {
      output = 'error parsing data: ' + err.message;
    }

    if (data) {
      try {
        template = pointy.parse(pointyCode.getValue());
      } catch (err) {
        output = 'error parsing template: ' + err.message;
      }
    }

    if (template) {
      try {
        fn = template.compile();
      } catch (err) {
        output = 'error compiling template: ' + err.message;
      }
    }

    if (fn) {
      try {
        output = fn(data);
      } catch(err) {
        output = 'error rendering template: ' + err.message;
      }
    }

    outputCode.setValue(output);
  });
});
