var gulp = require('gulp');
var KarmaServer = require('karma').Server;
var header = require('gulp-header');
var uglify = require('gulp-uglify');

gulp.task('build', function(done) {
    var pkg = require('./package.json');
    var banner = [
        '/**',
        ' * <%= pkg.name %> - <%= pkg.description %>',
        ' * @version v<%= pkg.version %>',
        ' * @link <%= pkg.homepage %>',
        ' * @license <%= pkg.license %>',
        ' */',
        ''].join('\n');

    return gulp.src(['src/ng-webworker.js', 'src/worker_wrapper.js', 'src/angularjs.js'])
        .pipe(uglify())
        .pipe(header(banner, { pkg : pkg } ))
        .pipe(gulp.dest('dist'));
});


gulp.task('test', function (done) {
    new KarmaServer({
        configFile: __dirname + '/karma.config.js',
        singleRun: true
    }, done).start();
});

