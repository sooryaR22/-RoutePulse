# RoutePulse

**Real-time crowd intelligence for public transport.**

RoutePulse is a web application that helps passengers discover active buses and view live crowd conditions using real-time passenger contributions.

Passengers contribute their presence when they board a bus, allowing other commuters to make better travel decisions based on the current crowd level.

## Live Demo

https://route-pulse-three.vercel.app

## Problem

Passengers using public transport often have no way to know how crowded a bus is before boarding.

This can lead to:

- Long waiting times
- Overcrowded journeys
- Poor travel decisions
- Lack of real-time information in small towns and local transport networks

## Solution

RoutePulse creates a real-time, community-powered transit visibility system.

Authorized conductors start live trips, while passengers contribute their presence when they board the bus.

The passenger count updates instantly across connected devices, allowing commuters to view active buses and estimate crowd conditions before choosing a ride.

## Features

- Discover active buses in real time
- Authorized conductor-only trip creation
- Live passenger contribution system
- Stop contributing when leaving the bus
- Real-time crowd count synchronization
- Low, Moderate, and High crowd indicators
- Join trips using a Trip ID
- Live trip status updates
- Conductor-only trip termination
- Responsive interface for desktop and mobile devices
- Firebase Authentication and Firestore security rules
- Automatic deployment through GitHub and Vercel

## How It Works

1. An authorized conductor starts a live bus trip.
2. The trip becomes visible on the Active Buses page.
3. Passengers open the trip and select **I'm On This Bus**.
4. RoutePulse adds the passenger to the live contribution count.
5. The crowd count updates in real time across connected devices.
6. Passengers select **Stop Contributing** when they leave the bus.
7. The conductor ends the trip when the journey is complete.

## Tech Stack

- React
- Vite
- Tailwind CSS
- Framer Motion
- Firebase Authentication
- Cloud Firestore
- React Router
- Vercel
- Git and GitHub

## Security

RoutePulse uses Firebase Authentication and Firestore Security Rules to enforce role-based access.

Only authorized conductor accounts can create and manage live trips.

Passengers can create and delete only their own contribution records.

## Future Improvements

- Real-time GPS bus tracking
- Estimated arrival times
- Route and bus stop visualization
- Automatic passenger contribution using geofencing
- Historical crowd analytics
- Conductor management dashboard
- Push notifications for bus arrivals
- Integration with public transport authorities

## Project Status

RoutePulse is a working MVP developed for the LIYA Tech Inaugural Hackathon 2026.

The application has been production deployed and tested across desktop and mobile devices.

## Author

**Soorya R**

Electronics and Communication Engineering  
SRM Institute of Science and Technology