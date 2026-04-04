(function(){
  if(typeof window.toggleFaq !== 'function'){
    window.toggleFaq = function(el){
      var item = el.parentElement;
      var ans = item && item.querySelector('.faq-a');
      var already = item && item.classList.contains('active');
      document.querySelectorAll('.faq-item').forEach(function(f){
        f.classList.remove('active');
        var panel = f.querySelector('.faq-a');
        if(panel){ panel.classList.remove('open'); }
      });
      if(item && ans && !already){ item.classList.add('active'); ans.classList.add('open'); }
    };
  }
  if(typeof window.tfaq !== 'function'){
    window.tfaq = function(el){
      var item = el.parentElement;
      var ans = item && item.querySelector('.fa');
      var already = item && item.classList.contains('act');
      document.querySelectorAll('.fi').forEach(function(f){
        f.classList.remove('act');
        var panel = f.querySelector('.fa');
        if(panel){ panel.classList.remove('open'); }
      });
      if(item && ans && !already){ item.classList.add('act'); ans.classList.add('open'); }
    };
  }
})();