var gulp = require('gulp');
var KarmaServer = require('karma').Server;
var header = require('gulp-header');
var uglify = require('gulp-uglify');
var rename = require("gulp-rename");


gulp.task('default', ['watch']);

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
    
    return gulp.src(['src/ng-webworker.js', 'src/worker_wrapper.js'])
        .pipe(uglify({
            mangle: {
                except: ['notify', 'complete', '_transferable_']
            }
        }))
        .pipe(header(banner, { pkg : pkg } ))
        .pipe(rename({
            suffix: ".min"
        }))
        .pipe(gulp.dest('src'));
});


gulp.task('test', function (done) {
    new KarmaServer({
        configFile: __dirname + '/karma.config.js',
        singleRun: true
    }, done).start();
});

