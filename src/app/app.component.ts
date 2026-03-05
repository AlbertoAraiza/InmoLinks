import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html'
})
export class AppComponent implements OnInit {
  title = 'inmolinks-app';

  ngOnInit() {
    this.loadGoogleMapsScript();
  }

  private loadGoogleMapsScript() {
    if (document.getElementById('google-maps-script')) return;

    const script = document.createElement('script');
    script.id = 'google-maps-script';
    // Using environment key securely outside of public HTML source
    script.src = `https://maps.googleapis.com/maps/api/js?key=${environment.googleMapsApiKey}&libraries=places&loading=async`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }
}
